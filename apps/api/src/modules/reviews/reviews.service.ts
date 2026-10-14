import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateReviewDto } from "./dto/review.dto";

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  private sanitizeImages(images?: string[]) {
    if (!images?.length) return [];
    return images
      .map((image) => image.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  async createReview(
    bookingId: string,
    userId: string,
    createReviewDto: CreateReviewDto,
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

    if (booking.status !== "completed") {
      throw new BadRequestException("Can only review completed bookings");
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

  async getReviews(userId: string, query: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const where = {
      revieweeId: provider.userId,
    };

    const [reviews, total, ratingBreakdown] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          booking: {
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
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({
        by: ["rating"],
        where,
        _count: { rating: true },
      }),
    ]);

    // Build rating breakdown
    const breakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingBreakdown.forEach((r) => {
      breakdown[r.rating] = r._count.rating;
    });

    return {
      data: reviews.map((review) => ({
        id: review.id,
        customer: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
        rating: review.rating,
        date: review.createdAt,
        service: review.booking.quote.request.title,
        job: {
          bookingId: review.bookingId,
          requestId: review.booking.quote.request.id,
          title: review.booking.quote.request.title,
        },
        customerComment: review.comment,
        comment: review.comment,
        reply: review.providerReply,
        images: review.images,
        replyImages: review.providerReplyImages,
      })),
      stats: {
        average: provider.ratingAvg,
        total,
        breakdown,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async replyToReview(
    userId: string,
    reviewId: string,
    reply: string,
    replyImages?: string[],
  ) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundException("Provider not found");
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    if (review.revieweeId !== provider.userId) {
      throw new ForbiddenException("Not authorized to reply to this review");
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        providerReply: reply,
        providerReplyImages: this.sanitizeImages(replyImages),
      },
    });
  }
}
