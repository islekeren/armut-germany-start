import { CategoriesService } from "./categories.service";

describe("CategoriesService", () => {
  const prisma = {
    category: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  let service: CategoriesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CategoriesService(prisma as any);
  });

  it("finds active categories ordered by German name", async () => {
    prisma.category.findMany.mockResolvedValue([{ id: "c1" }]);
    await service.findAll();
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { nameDe: "asc" },
      include: {
        _count: {
          select: { services: true },
        },
      },
    });
  });

  it("finds by slug", async () => {
    await service.findBySlug("cleaning");
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { slug: "cleaning" },
    });
  });

  it("finds by id", async () => {
    await service.findById("c1");
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: "c1" },
    });
  });
});
