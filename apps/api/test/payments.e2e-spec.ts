import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { StripeService } from "../src/modules/payments/stripe.service";
import {
  closeTestApp,
  createProviderFixture,
  createUserFixture,
  loginAs,
  prisma,
  resetAndSeedDatabase,
} from "./e2e-utils";

describe("Stripe Connect payments (e2e)", () => {
  let app: any;
  let webhookEvent: any;

  const stripeService = {
    getCommissionRate: jest.fn(() => 0.15),
    getCheckoutUrls: jest.fn((bookingId: string) => ({
      successUrl: `http://localhost/bookings/${bookingId}?payment=success`,
      cancelUrl: `http://localhost/bookings/${bookingId}?payment=cancel`,
    })),
    createConnectedAccount: jest.fn(),
    createOnboardingLink: jest.fn(),
    retrieveConnectedAccount: jest.fn(),
    toAccountSnapshot: jest.fn(),
    retrieveCheckoutSession: jest.fn(),
    expireCheckoutSession: jest.fn(),
    createCheckoutSession: jest.fn(),
    constructWebhookEvent: jest.fn(() => webhookEvent),
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StripeService)
      .useValue(stripeService)
      .compile();
    app = moduleFixture.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix("api");
    await app.init();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    stripeService.getCommissionRate.mockReturnValue(0.15);
    stripeService.constructWebhookEvent.mockImplementation(() => webhookEvent);
    await resetAndSeedDatabase();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it("protects and refreshes provider onboarding endpoints", async () => {
    await request(app.getHttpServer())
      .get("/api/providers/me/stripe-status")
      .expect(401);

    const { provider } = await createProviderFixture({
      email: "stripe-provider@example.com",
    });
    const auth = await loginAs(app, "stripe-provider@example.com");
    const account = { id: "acct_test_provider" };
    stripeService.createConnectedAccount.mockResolvedValue(account);
    stripeService.toAccountSnapshot.mockReturnValue({
      accountId: account.id,
      onboardingStatus: "pending",
      transfersEnabled: false,
      requirementsDue: [{ description: "identity" }],
      onboardedAt: null,
    });

    await request(app.getHttpServer())
      .post("/api/providers/me/stripe-account")
      .set("Authorization", `Bearer ${auth.accessToken}`)
      .expect(201)
      .expect((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            accountId: account.id,
            onboardingStatus: "pending",
          }),
        );
      });

    expect(stripeService.createConnectedAccount).toHaveBeenCalledWith(
      expect.objectContaining({ id: provider.id }),
    );
  });

  it("creates one destination-charge checkout and applies an idempotent paid webhook", async () => {
    const { user: customer } = await createUserFixture({
      email: "stripe-customer@example.com",
    });
    const { user: otherCustomer } = await createUserFixture({
      email: "stripe-other@example.com",
    });
    const { provider } = await createProviderFixture({
      email: "stripe-ready-provider@example.com",
    });
    await prisma.provider.update({
      where: { id: provider.id },
      data: {
        stripeAccountId: "acct_ready",
        stripeOnboardingStatus: "ready",
        stripeTransfersEnabled: true,
      },
    });

    const category = await prisma.category.findFirstOrThrow();
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        customerId: customer.id,
        categoryId: category.id,
        title: "Stripe demo cleaning",
        description: "Clean the apartment",
        address: "Teststrasse 1",
        city: "Berlin",
        postalCode: "10115",
        lat: 52.52,
        lng: 13.405,
        images: [],
        status: "in_progress",
      },
    });
    const quote = await prisma.quote.create({
      data: {
        requestId: serviceRequest.id,
        providerId: provider.id,
        customerId: customer.id,
        price: 100,
        message: "Test quote",
        validUntil: new Date(Date.now() + 86400000),
        status: "accepted",
      },
    });
    const booking = await prisma.booking.create({
      data: {
        quoteId: quote.id,
        customerId: customer.id,
        providerId: provider.id,
        scheduledDate: new Date(Date.now() + 172800000),
        status: "confirmed",
        totalPrice: 100,
      },
    });

    const customerAuth = await loginAs(app, "stripe-customer@example.com");
    const otherAuth = await loginAs(app, "stripe-other@example.com");
    stripeService.createCheckoutSession.mockResolvedValue({
      id: "cs_e2e",
      url: "https://checkout.stripe.test/e2e",
      payment_intent: null,
    });

    await request(app.getHttpServer())
      .post("/api/payments/checkout-session")
      .set("Authorization", `Bearer ${otherAuth.accessToken}`)
      .send({ bookingId: booking.id })
      .expect(403);

    const checkout = await request(app.getHttpServer())
      .post("/api/payments/checkout-session")
      .set("Authorization", `Bearer ${customerAuth.accessToken}`)
      .send({ bookingId: booking.id })
      .expect(201);

    expect(checkout.body.checkoutUrl).toBe("https://checkout.stripe.test/e2e");
    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent_data: expect.objectContaining({
          application_fee_amount: 1500,
          transfer_data: { destination: "acct_ready" },
        }),
      }),
      expect.stringMatching(/^checkout-session:/),
    );

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { bookingId: booking.id },
    });
    webhookEvent = {
      id: "evt_e2e_paid",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_e2e",
          amount_total: 10000,
          currency: "eur",
          payment_status: "paid",
          payment_intent: "pi_e2e",
          metadata: {
            paymentId: payment.id,
            bookingId: booking.id,
            providerId: provider.id,
            customerId: customer.id,
          },
        },
      },
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app.getHttpServer())
        .post("/api/payments/webhook")
        .set("stripe-signature", "test-signature")
        .send({ event: webhookEvent.id })
        .expect(200);
    }

    const [updatedBooking, updatedPayment, notifications] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }),
      prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      prisma.notification.findMany({
        where: { metadata: { path: ["paymentId"], equals: payment.id } },
      }),
    ]);
    expect(updatedBooking.status).toBe("confirmed");
    expect(updatedBooking.paymentStatus).toBe("paid");
    expect(updatedPayment.status).toBe("paid");
    expect(notifications).toHaveLength(2);
    expect(otherCustomer.id).not.toBe(customer.id);
  });
});
