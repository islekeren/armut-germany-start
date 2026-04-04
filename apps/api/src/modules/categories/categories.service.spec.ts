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
      where: {
        isActive: true,
        parentId: { not: null },
      },
      orderBy: { nameDe: "asc" },
      include: {
        parent: {
          select: {
            id: true,
            slug: true,
            nameDe: true,
            nameEn: true,
            icon: true,
          },
        },
        _count: {
          select: { services: true },
        },
      },
    });
  });

  it("finds by slug", async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: "c1",
      slug: "home-cleaning",
      isActive: true,
    });
    await service.findBySlug("home-cleaning");
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { slug: "home-cleaning" },
      include: {
        parent: {
          select: {
            id: true,
            slug: true,
            nameDe: true,
            nameEn: true,
            icon: true,
          },
        },
      },
    });
  });

  it("finds by id", async () => {
    prisma.category.findUnique.mockResolvedValue({
      id: "c1",
      slug: "home-cleaning",
      isActive: true,
    });
    await service.findById("c1");
    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: "c1" },
      include: {
        parent: {
          select: {
            id: true,
            slug: true,
            nameDe: true,
            nameEn: true,
            icon: true,
          },
        },
      },
    });
  });
});
