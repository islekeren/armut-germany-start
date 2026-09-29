import { UsersService } from "./users.service";

describe("UsersService", () => {
  const safeUserSelect = {
    id: true,
    email: true,
    phone: true,
    firstName: true,
    lastName: true,
    userType: true,
    profileImage: true,
    isVerified: true,
    gdprConsent: true,
    createdAt: true,
    updatedAt: true,
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma as any);
  });

  it("finds by id", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1" });
    await service.findById("u1");
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: "u1", deletedAt: null },
      select: safeUserSelect,
    });
  });

  it("finds by email", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1", email: "a@b.c" });
    await service.findByEmail("a@b.c");
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: "a@b.c", deletedAt: null },
      select: safeUserSelect,
    });
  });

  it("finds by id with password when needed internally", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "u1", password: "hash" });
    await service.findByIdWithPassword("u1");
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: "u1", deletedAt: null },
    });
  });

  it("finds by email with password when needed internally", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      password: "hash",
    });
    await service.findByEmailWithPassword("a@b.c");
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: "a@b.c", deletedAt: null },
    });
  });

  it("creates user", async () => {
    const data = {
      email: "a@b.c",
      password: "hash",
      firstName: "A",
      lastName: "B",
      userType: "customer" as const,
      gdprConsent: true,
    };
    prisma.user.create.mockResolvedValue({ id: "u1", ...data });

    await service.create(data);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data,
      select: safeUserSelect,
    });
  });

  it("updates user", async () => {
    await service.update("u1", { firstName: "Updated" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { firstName: "Updated" },
      select: safeUserSelect,
    });
  });

  it("never hard-deletes users", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.delete("u1")).rejects.toThrow("User not found");
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
