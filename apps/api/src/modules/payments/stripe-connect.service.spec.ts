import { NotFoundException } from "@nestjs/common";
import { StripeConnectService } from "./stripe-connect.service";

describe("StripeConnectService", () => {
  const prisma = {
    provider: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const stripeService = {
    createConnectedAccount: jest.fn(),
    createOnboardingLink: jest.fn(),
    retrieveConnectedAccount: jest.fn(),
    toAccountSnapshot: jest.fn(),
  };
  let service: StripeConnectService;

  const provider = {
    id: "provider-1",
    userId: "user-1",
    stripeAccountId: null,
    stripeOnboardingStatus: "not_started",
    stripeTransfersEnabled: false,
    stripeRequirementsDue: null,
    stripeOnboardedAt: null,
    user: {
      email: "provider@example.com",
      firstName: "Test",
      lastName: "Provider",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripeConnectService(prisma as any, stripeService as any);
  });

  it("requires an existing provider profile", async () => {
    prisma.provider.findUnique.mockResolvedValue(null);
    await expect(service.createAccount("user-1")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("creates an Accounts v2 recipient and persists its status", async () => {
    prisma.provider.findUnique.mockResolvedValue(provider);
    stripeService.createConnectedAccount.mockResolvedValue({ id: "acct_test" });
    stripeService.toAccountSnapshot.mockReturnValue({
      accountId: "acct_test",
      onboardingStatus: "pending",
      transfersEnabled: false,
      requirementsDue: [{ description: "identity" }],
      onboardedAt: null,
    });
    prisma.provider.update.mockResolvedValue({
      ...provider,
      stripeAccountId: "acct_test",
      stripeOnboardingStatus: "pending",
      stripeRequirementsDue: [{ description: "identity" }],
    });

    await expect(service.createAccount("user-1")).resolves.toEqual(
      expect.objectContaining({
        accountId: "acct_test",
        onboardingStatus: "pending",
      }),
    );
    expect(stripeService.createConnectedAccount).toHaveBeenCalledWith(provider);
  });
});
