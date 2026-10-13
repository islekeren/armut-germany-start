/* global process, require, console */
/* eslint-disable @typescript-eslint/no-require-imports -- Compiled test bootstrap uses CommonJS. */
// Local browser-test API with an explicit Stripe boundary mock. Never run in production.
if (
  process.env.NODE_ENV !== "test" ||
  process.env.E2E_STRIPE_MOCK !== "true" ||
  process.env.PAYMENTS_MODE !== "sandbox"
) {
  throw new Error(
    "Browser Stripe mock requires NODE_ENV=test, E2E_STRIPE_MOCK=true and PAYMENTS_MODE=sandbox",
  );
}
const { Test } = require("@nestjs/testing");
const { ConfigService } = require("@nestjs/config");
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("node:crypto");
const { AppModule } = require("../dist/app.module");
const { configureApp } = require("../dist/app.setup");
const { StripeService } = require("../dist/modules/payments/stripe.service");
const db = new PrismaClient();
const validator = new StripeService(new ConfigService(process.env));
validator.onModuleInit();
const sessions = new Map();
const outcomes = new Map();
const outcome = (key, prefix) => {
  if (!outcomes.has(key))
    outcomes.set(key, { id: `${prefix}_${randomUUID()}`, status: "pending" });
  return outcomes.get(key);
};
const snapshot = (provider) => ({
  accountId: provider.stripeAccountId,
  onboardingStatus: provider.stripeOnboardingStatus,
  transfersEnabled: provider.stripeTransfersEnabled,
  payoutsEnabled: provider.stripePayoutsEnabled,
  requirementsDue: [],
  onboardedAt: provider.stripeOnboardedAt,
});
const stripe = {
  assertEnabled: () => validator.assertEnabled(),
  assertEventMode: (event) => validator.assertEventMode(event),
  getPaymentsMode: () => "sandbox",
  getCommissionRate: () => validator.getCommissionRate(),
  getCheckoutUrls: (id) => validator.getCheckoutUrls(id),
  retrieveConnectedAccount: async (id) =>
    snapshot(
      await db.provider.findUniqueOrThrow({ where: { stripeAccountId: id } }),
    ),
  toAccountSnapshot: (account) => account,
  createConnectedAccount: async (provider) => ({
    accountId: `acct_mock_${provider.id}`,
    onboardingStatus: "pending",
    transfersEnabled: false,
    payoutsEnabled: false,
    requirementsDue: [],
    onboardedAt: null,
  }),
  createOnboardingLink: async () => ({
    url: "http://localhost:3000/dashboard/finances",
    expires_at: Math.floor(Date.now() / 1000) + 60,
  }),
  createExpressDashboardLoginLink: async () => ({
    url: "http://localhost:3000/dashboard/finances",
  }),
  retrieveCheckoutSession: async (id) => {
    if (!sessions.has(id)) throw new Error("Mock Session not found");
    return sessions.get(id);
  },
  createCheckoutSession: async (params) => {
    const id = `cs_mock_${params.metadata.attemptId}`;
    if (sessions.has(id)) return sessions.get(id);
    const session = {
      id,
      url: params.success_url,
      status: "open",
      payment_intent: `pi_mock_${params.metadata.attemptId}`,
    };
    sessions.set(id, session);
    return session;
  },
  retrievePaymentIntent: async (id) => ({ id, latest_charge: `ch_mock_${id}` }),
  createTransfer: async (_params, key) => outcome(key, "tr_mock"),
  reverseTransfer: async (_id, _params, key) => outcome(key, "rev_mock"),
  createRefund: async (_params, key) => outcome(key, "re_mock"),
  // Browser tests never bypass signed-webhook verification through this server.
  constructWebhookEvent: () => {
    throw new Error(
      "Use API webhook tests or an authorized real sandbox endpoint",
    );
  },
};
(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(StripeService)
    .useValue(stripe)
    .compile();
  const app = module.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.listen(Number(process.env.PORT || 4000));
  const stop = async () => {
    await app.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
