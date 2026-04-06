import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
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
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
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

    return category?.isActive && category.parentId ? category : null;
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
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

    return category?.isActive ? category : null;
  }
}
