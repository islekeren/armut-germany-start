import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateQuoteDto, UpdateQuoteDto } from "./dto/quote.dto";

@Injectable()
export class QuotesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createQuoteDto: CreateQuoteDto) {
    // Get provider by user ID
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenException("User is not a provider");
    }

    if (!provider.isApproved) {
      throw new ForbiddenException("Provider is not approved");
    }

    // Check if request exists and is open
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: createQuoteDto.requestId },
    });

    if (!request) {
      throw new NotFoundException("Service request not found");
    }

    if (request.status !== "open") {
      throw new BadRequestException("Request is not open for quotes");
    }

    // Check if provider already quoted this request
    const existingQuote = await this.prisma.quote.findFirst({
      where: {
        requestId: createQuoteDto.requestId,
        providerId: provider.id,
      },
    });

    if (existingQuote) {
      throw new BadRequestException("You have already quoted this request");
    }

    return this.prisma.quote.create({
      data: {
        requestId: createQuoteDto.requestId,
        providerId: provider.id,
        customerId: request.customerId,
        price: createQuoteDto.price,
        message: createQuoteDto.message,
        validUntil: new Date(createQuoteDto.validUntil),
      },
      include: {
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        },
        request: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async findByRequest(requestId: string, userId: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, customerId: true },
    });

    if (!request) {
      throw new NotFoundException("Service request not found");
    }

    const provider = await this.prisma.provider.findUnique({
      where: { userId },
      select: { id: true },
    });

    const hasAccess =
      request.customerId === userId ||
      (provider
        ? !!(await this.prisma.quote.findFirst({
            where: {
              requestId,
              providerId: provider.id,
            },
            select: { id: true },
          }))
        : false);

    if (!hasAccess) {
      throw new ForbiddenException("Not authorized to view quotes for this request");
    }

    return this.prisma.quote.findMany({
      where: { requestId },
      orderBy: { createdAt: "desc" },
      include: {
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });
  }

  async findByProvider(userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    return this.prisma.quote.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: "desc" },
      include: {
        request: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            category: true,
          },
        },
      },
    });
  }

  async findByCustomer(userId: string) {
    return this.prisma.quote.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        },
        request: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                phone: true,
              },
            },
          },
        },
        request: {
          include: {
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            category: true,
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { userType: true },
    });

    if (user?.userType !== "admin") {
      const provider = await this.prisma.provider.findUnique({
        where: { userId },
        select: { id: true },
      });

      const hasAccess =
        quote.customerId === userId || provider?.id === quote.providerId;

      if (!hasAccess) {
        throw new ForbiddenException("Not authorized to view this quote");
      }
    }

    return quote;
  }

  async update(id: string, userId: string, updateQuoteDto: UpdateQuoteDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenException("User is not a provider");
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    if (quote.providerId !== provider.id) {
      throw new ForbiddenException("Not authorized to update this quote");
    }

    if (quote.status !== "pending") {
      throw new BadRequestException("Can only update pending quotes");
    }

    return this.prisma.quote.update({
      where: { id },
      data: {
        ...updateQuoteDto,
        validUntil: updateQuoteDto.validUntil
          ? new Date(updateQuoteDto.validUntil)
          : undefined,
      },
    });
  }

  async respond(id: string, userId: string, action: "accepted" | "rejected") {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        request: true,
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    if (quote.customerId !== userId) {
      throw new ForbiddenException("Not authorized to respond to this quote");
    }

    if (quote.status !== "pending") {
      throw new BadRequestException("Quote is not pending");
    }

    // If accepting, reject all other quotes for this request
    if (action === "accepted") {
      await this.prisma.$transaction([
        // Update this quote to accepted
        this.prisma.quote.update({
          where: { id },
          data: { status: "accepted" },
        }),
        // Reject all other pending quotes
        this.prisma.quote.updateMany({
          where: {
            requestId: quote.requestId,
            id: { not: id },
            status: "pending",
          },
          data: { status: "rejected" },
        }),
        // Update request status
        this.prisma.serviceRequest.update({
          where: { id: quote.requestId },
          data: { status: "in_progress" },
        }),
      ]);

      return this.findOne(id, userId);
    }

    // If rejecting
    return this.prisma.quote.update({
      where: { id },
      data: { status: "rejected" },
    });
  }

  async withdraw(id: string, userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenException("User is not a provider");
    }

    const quote = await this.prisma.quote.findUnique({
      where: { id },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    if (quote.providerId !== provider.id) {
      throw new ForbiddenException("Not authorized to withdraw this quote");
    }

    if (quote.status !== "pending") {
      throw new BadRequestException("Can only withdraw pending quotes");
    }

    return this.prisma.quote.delete({
      where: { id },
    });
  }
}
