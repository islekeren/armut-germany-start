import { ConfigService } from "@nestjs/config";
import { StripeService } from "./stripe.service";

const sandbox = {
  PAYMENTS_MODE: "sandbox",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_WEBHOOK_MODE: "sandbox",
  STRIPE_CONNECT_RETURN_URL: "http://localhost/return",
  STRIPE_CONNECT_REFRESH_URL: "http://localhost/refresh",
  STRIPE_CHECKOUT_SUCCESS_URL: "http://localhost/{bookingId}",
  STRIPE_CHECKOUT_CANCEL_URL: "http://localhost/{bookingId}",
  NODE_ENV: "test",
};
const service = (config: Record<string, string> = {}) =>
  new StripeService(new ConfigService(config));
describe("explicit payment configuration", () => {
  it("defaults disabled without demanding keys", () => {
    const stripe = service();
    expect(() => stripe.onModuleInit()).not.toThrow();
    expect((stripe as any).getPaymentsMode()).toBe("disabled");
    expect(() => (stripe as any).assertEnabled()).toThrow();
  });
  it("validates even in NODE_ENV=test", () => {
    expect(() =>
      service({ ...sandbox, STRIPE_WEBHOOK_SECRET: "" }).onModuleInit(),
    ).toThrow();
  });
  it.each([
    { PAYMENTS_MODE: "invalid" },
    { STRIPE_SECRET_KEY: "sk_live_fixture" },
    { STRIPE_WEBHOOK_MODE: "live" },
    { STRIPE_PUBLISHABLE_KEY: "pk_live_fixture" },
    { STRIPE_CHECKOUT_SUCCESS_URL: "http://localhost" },
  ])("rejects inconsistent configuration %s", (change) => {
    expect(() => service({ ...sandbox, ...change }).onModuleInit()).toThrow();
  });
  it("accepts explicit sandbox configuration", () =>
    expect(() => service(sandbox).onModuleInit()).not.toThrow());
  it("live requires explicit opt-in and HTTPS", () => {
    const live = {
      ...sandbox,
      PAYMENTS_MODE: "live",
      STRIPE_WEBHOOK_MODE: "live",
      STRIPE_SECRET_KEY: "rk_live_fixture",
    };
    expect(() => service(live).onModuleInit()).toThrow();
    expect(() =>
      service({ ...live, STRIPE_LIVE_ENABLED: "true" }).onModuleInit(),
    ).toThrow();
    const https = Object.fromEntries(
      Object.entries(live).map(([key, value]) => [
        key,
        value.replace("http:", "https:"),
      ]),
    );
    expect(() =>
      service({ ...https, STRIPE_LIVE_ENABLED: "true" }).onModuleInit(),
    ).not.toThrow();
  });
  it("rejects a signed event from the wrong mode", () => {
    expect(() =>
      (service(sandbox) as any).assertEventMode({ livemode: true }),
    ).toThrow();
  });
});
