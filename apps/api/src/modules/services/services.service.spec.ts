import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { ServicesService } from "./services.service";

describe("provider service management", () => {
  const provider = {
    id: "provider-1",
    userId: "user-1",
    user: { userType: "provider" },
  };
  const category = { id: "category-1", isActive: true, parentId: "sector-1" };
  const existing = {
    id: "service-1",
    providerId: provider.id,
    categoryId: category.id,
    title: "Cleaning",
    description: "Home cleaning",
    priceType: "hourly",
    priceMin: 20,
    priceMax: 50,
    isActive: true,
  };
  const input = {
    categoryId: category.id,
    title: "Cleaning",
    description: "Home cleaning",
    priceType: "hourly" as const,
    priceMin: 20,
    priceMax: 50,
  };
  let service: ServicesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      provider: { findUnique: jest.fn().mockResolvedValue(provider) },
      category: { findUnique: jest.fn().mockResolvedValue(category) },
      service: {
        findMany: jest.fn().mockResolvedValue([existing]),
        findFirst: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve(
              where.providerId === existing.providerId ? existing : null,
            ),
          ),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: "new-service", ...data }),
          ),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...existing, ...data }),
          ),
        delete: jest.fn().mockResolvedValue(existing),
      },
    };
    service = new ServicesService(prisma as PrismaService);
  });

  it("lists the owner's active and inactive services", async () => {
    expect(await service.findAll(provider.userId)).toEqual([existing]);
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerId: provider.id } }),
    );
  });

  it("creates a service owned by the authenticated provider", async () => {
    expect(await service.create(provider.userId, input)).toMatchObject({
      ...input,
      providerId: provider.id,
    });
  });

  it("allows editing and deactivating an owned service", async () => {
    expect(
      await service.update(provider.userId, existing.id, {
        title: "Office cleaning",
        isActive: false,
      }),
    ).toMatchObject({ title: "Office cleaning", isActive: false });
  });

  it("clears prices when explicitly sent as null", async () => {
    expect(
      await service.update(provider.userId, existing.id, {
        priceMin: null,
        priceMax: null,
      }),
    ).toMatchObject({ priceMin: null, priceMax: null });
  });

  it("deletes an owned service", async () => {
    await expect(service.remove(provider.userId, existing.id)).resolves.toEqual(
      existing,
    );
  });

  it.each(["findAll", "create", "update", "remove"])(
    "denies %s to users without a provider",
    async (method) => {
      prisma.provider.findUnique.mockResolvedValue(null);
      const calls = {
        findAll: () => service.findAll("customer"),
        create: () => service.create("customer", input),
        update: () => service.update("customer", existing.id, {}),
        remove: () => service.remove("customer", existing.id),
      };
      await expect(
        calls[method as keyof typeof calls](),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it("denies customers even if a provider row exists", async () => {
    prisma.provider.findUnique.mockResolvedValue({
      ...provider,
      user: { userType: "customer" },
    });
    await expect(service.create(provider.userId, input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each(["update", "remove"])(
    "prevents %s of another provider's service",
    async (method) => {
      prisma.provider.findUnique.mockResolvedValue({
        ...provider,
        id: "other-provider",
      });
      const call =
        method === "update"
          ? service.update("other-user", existing.id, { title: "Stolen" })
          : service.remove("other-user", existing.id);
      await expect(call).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.service.update).not.toHaveBeenCalled();
      expect(prisma.service.delete).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    { ...category, isActive: false },
    { ...category, parentId: null },
  ])(
    "rejects missing, inactive and sector categories: %p",
    async (invalidCategory) => {
      prisma.category.findUnique.mockResolvedValue(invalidCategory);
      await expect(
        service.create(provider.userId, input),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.service.create).not.toHaveBeenCalled();
    },
  );

  it("validates a changed category", async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(
      service.update(provider.userId, existing.id, { categoryId: "missing" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a reversed range on create", async () => {
    await expect(
      service.create(provider.userId, { ...input, priceMin: 60 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates partial price updates against the stored range", async () => {
    await expect(
      service.update(provider.userId, existing.id, { priceMin: 60 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update(provider.userId, existing.id, { priceMax: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it("allows deactivating a service whose category was retired", async () => {
    prisma.category.findUnique.mockResolvedValue({
      ...category,
      isActive: false,
    });
    await expect(
      service.update(provider.userId, existing.id, { isActive: false }),
    ).resolves.toMatchObject({ isActive: false });
  });

  it("prevents reactivating a service whose category was retired", async () => {
    prisma.category.findUnique.mockResolvedValue({
      ...category,
      isActive: false,
    });
    await expect(
      service.update(provider.userId, existing.id, { isActive: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
