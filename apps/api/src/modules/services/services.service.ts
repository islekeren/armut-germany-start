import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateServiceDto, UpdateServiceDto } from "./dto/service.dto";

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getProvider(userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
      include: { user: { select: { userType: true } } },
    });
    if (!provider || provider.user.userType !== "provider") {
      throw new ForbiddenException("A provider profile is required");
    }
    return provider;
  }

  private async validateCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category?.isActive || !category.parentId) {
      throw new BadRequestException("Select an active service category");
    }
  }

  private validatePrices(priceMin?: number | null, priceMax?: number | null) {
    if (priceMin != null && priceMax != null && priceMin > priceMax) {
      throw new BadRequestException(
        "Minimum price must not exceed maximum price",
      );
    }
  }

  async findAll(userId: string) {
    const provider = await this.getProvider(userId);
    return this.prisma.service.findMany({
      where: { providerId: provider.id },
      include: { category: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async create(userId: string, dto: CreateServiceDto) {
    const provider = await this.getProvider(userId);
    await this.validateCategory(dto.categoryId);
    this.validatePrices(dto.priceMin, dto.priceMax);
    return this.prisma.service.create({
      data: {
        providerId: provider.id,
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        priceType: dto.priceType,
        priceMin: dto.priceMin ?? null,
        priceMax: dto.priceMax ?? null,
        isActive: dto.isActive ?? true,
        images: [],
      },
      include: { category: true },
    });
  }

  private async getOwnedService(userId: string, id: string) {
    const provider = await this.getProvider(userId);
    const service = await this.prisma.service.findFirst({
      where: { id, providerId: provider.id },
    });
    if (!service) throw new NotFoundException("Service not found");
    return service;
  }

  async update(userId: string, id: string, dto: UpdateServiceDto) {
    const service = await this.getOwnedService(userId, id);
    if (dto.categoryId !== undefined || dto.isActive === true) {
      await this.validateCategory(dto.categoryId ?? service.categoryId);
    }
    this.validatePrices(
      dto.priceMin === undefined ? service.priceMin : dto.priceMin,
      dto.priceMax === undefined ? service.priceMax : dto.priceMax,
    );
    // Explicit fields keep ownership and image storage outside this API.
    return this.prisma.service.update({
      where: { id, providerId: service.providerId },
      data: {
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        priceType: dto.priceType,
        priceMin: dto.priceMin,
        priceMax: dto.priceMax,
        isActive: dto.isActive,
      },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    const service = await this.getOwnedService(userId, id);
    return this.prisma.service.delete({
      where: { id, providerId: service.providerId },
    });
  }
}
