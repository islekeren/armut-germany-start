import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  CreateBookingDto,
  UpdateBookingDto,
  CreateReviewDto,
  BookingQueryDto,
} from "./dto/booking.dto";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private sanitizeImages(images?: string[]) {
    if (!images?.length) return [];
    return images.map((image) => image.trim()).filter(Boolean).slice(0, 10);
  }

  private async notifyCustomerCompletionRequested(booking: {
    customerId: string;
    provider: { userId: string };
    quote: { requestId: string };
  }) {
    const requestId = booking.quote.requestId;
    const providerUserId = booking.provider.userId;
    const customerId = booking.customerId;

    const existingConversation = await this.prisma.conversation.findFirst({
      where: {
        requestId,
        AND: [
          { participants: { some: { userId: providerUserId } } },
          { participants: { some: { userId: customerId } } },
        ],
      },
      select: { id: true },
    });

    const conversation =
      existingConversation ||
      (await this.prisma.conversation.create({
        data: {
          requestId,
          participants: {
            create: [{ userId: providerUserId }, { userId: customerId }],
          },
        },
        select: { id: true },
      }));

    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: providerUserId,
          content:
            "I have completed this job. Please review and confirm completion.",
          attachments: [],
        },
      }),
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);
  }

  async create(userId: string, createBookingDto: CreateBookingDto) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: createBookingDto.quoteId },
      include: {
        request: true,
      },
    });

    if (!quote) {
      throw new NotFoundException("Quote not found");
    }

    if (quote.customerId !== userId) {
      throw new ForbiddenException("Not authorized to create this booking");
    }

    if (quote.status !== "accepted") {
      throw new BadRequestException("Quote must be accepted first");
    }

    // Check if booking already exists for this quote
    const existingBooking = await this.prisma.booking.findUnique({
      where: { quoteId: quote.id },
    });

    if (existingBooking) {
      throw new BadRequestException("Booking already exists for this quote");
    }

    return this.prisma.booking.create({
      data: {
        quoteId: quote.id,
        customerId: userId,
        providerId: quote.providerId,
        scheduledDate: new Date(createBookingDto.scheduledDate),
        totalPrice: quote.price,
      },
      include: {
        quote: {
          include: {
            request: {
              include: {
                category: true,
              },
            },
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                profileImage: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });
  }

  async findByCustomer(userId: string, query: BookingQueryDto) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = { customerId: userId };
    if (status) {
      where.status = status;
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledDate: "desc" },
      include: {
        quote: {
          include: {
            request: {
              include: {
                category: true,
              },
            },
          },
        },
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
        review: true,
      },
    });

    const total = await this.prisma.booking.count({ where });

    return {
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByProvider(userId: string, query: BookingQueryDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = { providerId: provider.id };
    if (status) {
      where.status = status;
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledDate: "desc" },
      include: {
        quote: {
          include: {
            request: {
              include: {
                category: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            profileImage: true,
          },
        },
        review: true,
      },
    });

    const total = await this.prisma.booking.count({ where });

    return {
      data: bookings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        quote: {
          include: {
            request: {
              include: {
                category: true,
              },
            },
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                profileImage: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        review: true,
        payment: true,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    return booking;
  }

  async updateStatus(id: string, userId: string, status: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        provider: true,
        quote: true,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    const isProvider = booking.provider.userId === userId;
    const isCustomer = booking.customerId === userId;

    if (!isProvider && !isCustomer) {
      throw new ForbiddenException("Not authorized to update this booking");
    }

    // Validate status transitions
    const allowedTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["in_progress", "completion_pending", "cancelled"],
      in_progress: ["completion_pending"],
      completion_pending: ["completed"],
      completed: [],
      cancelled: [],
    };

    if (!allowedTransitions[booking.status]?.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${booking.status} to ${status}`
      );
    }

    // Provider-driven states
    if (["confirmed", "in_progress", "completion_pending"].includes(status) && !isProvider) {
      throw new ForbiddenException("Only provider can update to this status");
    }

    // Customer approves final completion
    if (status === "completed") {
      if (!isCustomer) {
        throw new ForbiddenException("Only customer can confirm completion");
      }
      if (booking.status !== "completion_pending") {
        throw new BadRequestException(
          "Booking must be marked as completion pending before customer confirmation",
        );
      }
    }

    const previousStatus = booking.status;
    const updateData: any = { status };
    if (status === "completed") {
      updateData.completedAt = new Date();

      // Update request status
      await this.prisma.serviceRequest.update({
        where: { id: booking.quote.requestId },
        data: { status: "completed" },
      });
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: updateData,
      include: {
        quote: {
          include: {
            request: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        provider: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (status === "completion_pending") {
      const requestId = updatedBooking.quote?.request?.id ?? updatedBooking.quote?.requestId;
      const requestTitle = updatedBooking.quote?.request?.title ?? "service request";
      await this.notifyCustomerCompletionRequested(updatedBooking);
      if (updatedBooking.customer?.id) {
        await this.notificationsService.create(updatedBooking.customer.id, {
          type: "booking_completion_pending",
          title: "Completion confirmation required",
          message: `Provider marked "${requestTitle}" as completed. Please confirm.`,
          metadata: {
            bookingId: updatedBooking.id,
            requestId,
          },
        });
      }
    }

    if (status === "completed") {
      const requestId = updatedBooking.quote?.request?.id ?? updatedBooking.quote?.requestId;
      const requestTitle = updatedBooking.quote?.request?.title ?? "service request";
      const customerUserId = updatedBooking.customer?.id;
      const providerUserId = updatedBooking.provider?.user?.id;
      const tasks: Promise<unknown>[] = [];

      if (customerUserId) {
        tasks.push(
          this.notificationsService.create(customerUserId, {
            type: "booking_completed",
            title: "Job completed",
            message: `Booking "${requestTitle}" is marked as completed.`,
            metadata: {
              bookingId: updatedBooking.id,
              requestId,
            },
          }),
        );
      }
      if (providerUserId) {
        tasks.push(
          this.notificationsService.create(providerUserId, {
            type: "booking_completed",
            title: "Job completed",
            message: `Booking "${requestTitle}" has been confirmed as completed.`,
            metadata: {
              bookingId: updatedBooking.id,
              requestId,
            },
          }),
        );
      }

      await Promise.all(tasks);
    }

    if (status === "cancelled") {
      const requestId = updatedBooking.quote?.request?.id ?? updatedBooking.quote?.requestId;
      const requestTitle = updatedBooking.quote?.request?.title ?? "service request";
      const customerUserId = updatedBooking.customer?.id;
      const providerUserId = updatedBooking.provider?.user?.id;
      const actorLabel = isProvider ? "provider" : "customer";
      const message = `Booking "${requestTitle}" was cancelled by the ${actorLabel}.`;
      const tasks: Promise<unknown>[] = [];
      if (customerUserId) {
        tasks.push(
          this.notificationsService.create(customerUserId, {
            type: "booking_cancelled",
            title: "Booking cancelled",
            message,
            metadata: {
              bookingId: updatedBooking.id,
              requestId,
              previousStatus,
            },
          }),
        );
      }
      if (providerUserId) {
        tasks.push(
          this.notificationsService.create(providerUserId, {
            type: "booking_cancelled",
            title: "Booking cancelled",
            message,
            metadata: {
              bookingId: updatedBooking.id,
              requestId,
              previousStatus,
            },
          }),
        );
      }
      await Promise.all(tasks);
    }

    return updatedBooking;
  }

  async reschedule(id: string, userId: string, scheduledDate: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    if (booking.customerId !== userId) {
      throw new ForbiddenException("Only customer can reschedule");
    }

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new BadRequestException("Cannot reschedule booking at this stage");
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        scheduledDate: new Date(scheduledDate),
        status: "pending", // Needs re-confirmation
      },
    });
  }

  async createReview(
    bookingId: string,
    userId: string,
    createReviewDto: CreateReviewDto
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    if (booking.customerId !== userId) {
      throw new ForbiddenException("Only customer can review");
    }

    if (booking.status === "cancelled") {
      throw new BadRequestException("Cannot review a cancelled booking");
    }

    const reviewAvailableAt = new Date(booking.scheduledDate);
    if (new Date() < reviewAvailableAt) {
      throw new BadRequestException("Review is available after the scheduled time");
    }

    if (booking.review) {
      throw new BadRequestException("Review already exists");
    }

    const review = await this.prisma.review.create({
      data: {
        bookingId,
        reviewerId: userId,
        revieweeId: booking.provider.userId,
        rating: createReviewDto.rating,
        comment: createReviewDto.comment,
        images: this.sanitizeImages(createReviewDto.images),
      },
    });

    // Update provider rating
    const reviews = await this.prisma.review.findMany({
      where: { revieweeId: booking.provider.userId },
    });

    const avgRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await this.prisma.provider.update({
      where: { id: booking.providerId },
      data: {
        ratingAvg: avgRating,
        totalReviews: reviews.length,
      },
    });

    return review;
  }

  async addProviderReply(
    bookingId: string,
    userId: string,
    reply: string,
    replyImages?: string[],
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundException("Booking not found");
    }

    if (booking.provider.userId !== userId) {
      throw new ForbiddenException("Only provider can reply");
    }

    if (!booking.review) {
      throw new BadRequestException("No review to reply to");
    }

    return this.prisma.review.update({
      where: { id: booking.review.id },
      data: {
        providerReply: reply,
        providerReplyImages: this.sanitizeImages(replyImages),
      },
    });
  }

  async getUpcoming(userId: string, role: "customer" | "provider") {
    const where: any = {
      status: { in: ["pending", "confirmed"] },
      scheduledDate: { gte: new Date() },
    };

    if (role === "customer") {
      where.customerId = userId;
    } else {
      const provider = await this.prisma.provider.findUnique({
        where: { userId },
      });
      if (!provider) {
        throw new NotFoundException("Provider not found");
      }
      where.providerId = provider.id;
    }

    return this.prisma.booking.findMany({
      where,
      orderBy: { scheduledDate: "asc" },
      take: 10,
      include: {
        quote: {
          include: {
            request: {
              include: {
                category: true,
              },
            },
          },
        },
        provider: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        },
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
