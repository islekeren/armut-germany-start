import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StripeOnboardingStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { StripeAccountSnapshot, StripeService } from "./stripe.service";

@Injectable()
export class StripeConnectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  private async getProvider(userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!provider) throw new NotFoundException("Provider not found");
    return provider;
  }

  private response(provider: {
    stripeAccountId: string | null;
    stripeOnboardingStatus: StripeOnboardingStatus;
    stripeTransfersEnabled: boolean;
    stripePayoutsEnabled: boolean;
    stripeRequirementsDue: Prisma.JsonValue | null;
    stripeOnboardedAt: Date | null;
  }) {
    return {
      accountId: provider.stripeAccountId,
      onboardingStatus: provider.stripeOnboardingStatus,
      transfersEnabled: provider.stripeTransfersEnabled,
      payoutsEnabled: provider.stripePayoutsEnabled,
      requirementsDue: provider.stripeRequirementsDue ?? [],
      onboardedAt: provider.stripeOnboardedAt,
    };
  }

  private async persistSnapshot(providerId: string, snapshot: StripeAccountSnapshot) {
    return this.prisma.provider.update({
      where: { id: providerId },
      data: {
        stripeAccountId: snapshot.accountId,
        stripeOnboardingStatus: snapshot.onboardingStatus,
        stripeTransfersEnabled: snapshot.transfersEnabled,
        stripePayoutsEnabled: snapshot.payoutsEnabled,
        stripeRequirementsDue: snapshot.requirementsDue as Prisma.InputJsonValue,
        stripeOnboardedAt: snapshot.onboardedAt,
      },
    });
  }

  async createAccount(userId: string) {
    const provider = await this.getProvider(userId);
    if (provider.stripeAccountId) return this.refreshStatus(userId);

    const account = await this.stripeService.createConnectedAccount(provider);
    const updated = await this.persistSnapshot(
      provider.id,
      this.stripeService.toAccountSnapshot(account),
    );
    return this.response(updated);
  }

  async createOnboardingLink(userId: string) {
    let provider = await this.getProvider(userId);
    if (!provider.stripeAccountId) {
      await this.createAccount(userId);
      provider = await this.getProvider(userId);
    }

    const link = await this.stripeService.createOnboardingLink(
      provider.stripeAccountId!,
    );
    return { url: link.url, expiresAt: link.expires_at };
  }

  async refreshStatus(userId: string) {
    const provider = await this.getProvider(userId);
    if (!provider.stripeAccountId) return this.response(provider);

    const account = await this.stripeService.retrieveConnectedAccount(
      provider.stripeAccountId,
    );
    const updated = await this.persistSnapshot(
      provider.id,
      this.stripeService.toAccountSnapshot(account),
    );
    return this.response(updated);
  }

  async createDashboardLoginLink(userId: string) {
    const provider = await this.getProvider(userId);
    if (
      !provider.stripeAccountId ||
      provider.stripeOnboardingStatus !== "ready"
    ) {
      throw new NotFoundException("Provider Stripe account is not ready");
    }

    const link = await this.stripeService.createExpressDashboardLoginLink(
      provider.stripeAccountId,
    );
    return { url: link.url };
  }
}
