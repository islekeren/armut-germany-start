const { PrismaService: RealPrismaService } = jest.requireActual("./prisma.service");

describe("PrismaService", () => {
  let service: InstanceType<typeof RealPrismaService>;

  beforeEach(() => {
    service = new RealPrismaService();
  });

  it("connects on module init", async () => {
    const connectSpy = jest
      .spyOn(service, "$connect")
      .mockResolvedValue(undefined as never);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it("disconnects on module destroy", async () => {
    const disconnectSpy = jest
      .spyOn(service, "$disconnect")
      .mockResolvedValue(undefined as never);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
