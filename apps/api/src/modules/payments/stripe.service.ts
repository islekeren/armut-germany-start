import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

export interface StripeAccountSnapshot {
  accountId: string;
  onboardingStatus: "pending" | "restricted" | "ready";
  transfersEnabled: boolean;
  requirementsDue: unknown[];
  onboardedAt: Date | null;
}

@Injectable()
export class StripeService implements OnModuleInit {
  private stripeClient?: Stripe;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (this.configService.get<string>("NODE_ENV") !== "test") {
      this.validateConfiguration();
    }
  }

  private required(name: string) {
    const value = this.configService.get<string>(name)?.trim();
    if (!value) {
      throw new InternalServerErrorException(`${name} is required`);
    }
    return value;
  }

  private validateUrl(name: string, requireBookingId = false) {
    const value = this.required(name);
    if (requireBookingId && !value.includes("{bookingId}")) {
      throw new InternalServerErrorException(
        `${name} must contain {bookingId}`,
      );
    }

    try {
      const parsed = new URL(value.replace("{bookingId}", "demo-booking"));
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new InternalServerErrorException(`${name} must be a valid URL`);
    }

    return value;
  }

  private validateConfiguration() {
    const secretKey = this.required("STRIPE_SECRET_KEY");
    if (!secretKey.startsWith("sk_test_")) {
      throw new InternalServerErrorException(
        "Only Stripe test-mode secret keys are allowed",
      );
    }

    const webhookSecret = this.required("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret.startsWith("whsec_")) {
      throw new InternalServerErrorException(
        "STRIPE_WEBHOOK_SECRET must start with whsec_",
      );
    }

    this.validateUrl("STRIPE_CONNECT_RETURN_URL");
    this.validateUrl("STRIPE_CONNECT_REFRESH_URL");
    this.validateUrl("STRIPE_CHECKOUT_SUCCESS_URL", true);
    this.validateUrl("STRIPE_CHECKOUT_CANCEL_URL", true);
    this.getCommissionRate();
  }

  private get stripe() {
    if (!this.stripeClient) {
      const secretKey = this.required("STRIPE_SECRET_KEY");
      if (!secretKey.startsWith("sk_test_")) {
        throw new InternalServerErrorException(
          "Only Stripe test-mode secret keys are allowed",
        );
      }
      this.stripeClient = new Stripe(secretKey, {
        apiVersion: "2026-02-25.clover" as Stripe.LatestApiVersion,
        appInfo: { name: "Armut Germany", version: "0.1.0" },
      });
    }
    return this.stripeClient;
  }

  getCommissionRate() {
    const raw = this.configService.get<string>("PLATFORM_COMMISSION_RATE") ?? "0.15";
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate <= 0 || rate >= 1) {
      throw new InternalServerErrorException(
        "PLATFORM_COMMISSION_RATE must be between 0 and 1",
      );
    }
    return rate;
  }

  getCheckoutUrls(bookingId: string) {
    return {
      successUrl: this.validateUrl("STRIPE_CHECKOUT_SUCCESS_URL", true).replace(
        "{bookingId}",
        encodeURIComponent(bookingId),
      ),
      cancelUrl: this.validateUrl("STRIPE_CHECKOUT_CANCEL_URL", true).replace(
        "{bookingId}",
        encodeURIComponent(bookingId),
      ),
    };
  }

  async createConnectedAccount(provider: {
    id: string;
    companyName: string | null;
    user: { email: string; firstName: string; lastName: string };
  }) {
    const displayName =
      provider.companyName?.trim() ||
      `${provider.user.firstName} ${provider.user.lastName}`.trim();

    return this.stripe.v2.core.accounts.create(
      {
        contact_email: provider.user.email,
        display_name: displayName,
        dashboard: "express",
        identity: { country: "de" },
        defaults: {
          currency: "eur",
          locales: ["de-DE"],
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: { requested: true },
              },
            },
          },
        },
        include: ["configuration.recipient", "requirements"],
        metadata: { providerId: provider.id },
      },
      { idempotencyKey: `provider-account:${provider.id}` },
    );
  }

  async createOnboardingLink(accountId: string) {
    return this.stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          collection_options: {
            fields: "eventually_due",
            future_requirements: "include",
          },
          return_url: this.validateUrl("STRIPE_CONNECT_RETURN_URL"),
          refresh_url: this.validateUrl("STRIPE_CONNECT_REFRESH_URL"),
        },
      },
    });
  }

  async retrieveConnectedAccount(accountId: string) {
    return this.stripe.v2.core.accounts.retrieve(accountId, {
      include: ["configuration.recipient", "requirements"],
    });
  }

  toAccountSnapshot(account: Stripe.V2.Core.Account): StripeAccountSnapshot {
    const transferStatus =
      account.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status;
    const requirementsDue = account.requirements?.entries ?? [];
    const transfersEnabled = transferStatus === "active";
    const onboardingStatus = transfersEnabled && requirementsDue.length === 0
      ? "ready"
      : transferStatus === "restricted" || transferStatus === "unsupported"
        ? "restricted"
        : "pending";

    return {
      accountId: account.id,
      onboardingStatus,
      transfersEnabled,
      requirementsDue,
      onboardedAt: onboardingStatus === "ready" ? new Date() : null,
    };
  }

  async retrieveCheckoutSession(sessionId: string) {
    return this.stripe.checkout.sessions.retrieve(sessionId);
  }

  async expireCheckoutSession(sessionId: string) {
    return this.stripe.checkout.sessions.expire(sessionId);
  }

  async createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
    idempotencyKey: string,
  ) {
    return this.stripe.checkout.sessions.create(params, { idempotencyKey });
  }

  constructWebhookEvent(rawBody: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.required("STRIPE_WEBHOOK_SECRET"),
    );
  }
}
