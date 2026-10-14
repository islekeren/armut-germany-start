import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import {
  CreateReviewDto,
  ProviderReplyDto,
  ReviewsQueryDto,
  ReplyToReviewDto,
} from "./dto/review.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post("bookings/:id/review")
  @UseGuards(JwtAuthGuard)
  createReview(
    @Param("id") id: string,
    @Req() req: any,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(id, req.user.id, createReviewDto);
  }

  @Post("bookings/:id/reply")
  @UseGuards(JwtAuthGuard)
  addProviderReply(
    @Param("id") id: string,
    @Req() req: any,
    @Body() replyDto: ProviderReplyDto,
  ) {
    return this.reviewsService.addProviderReply(
      id,
      req.user.id,
      replyDto.reply,
      replyDto.replyImages,
    );
  }

  @Get("providers/me/reviews")
  @UseGuards(JwtAuthGuard)
  getMyReviews(@Req() req: any, @Query() query: ReviewsQueryDto) {
    return this.reviewsService.getReviews(req.user.id, query);
  }

  @Post("providers/me/reviews/:reviewId/reply")
  @UseGuards(JwtAuthGuard)
  replyToReview(
    @Req() req: any,
    @Param("reviewId") reviewId: string,
    @Body() body: ReplyToReviewDto,
  ) {
    return this.reviewsService.replyToReview(
      req.user.id,
      reviewId,
      body.reply,
      body.replyImages,
    );
  }
}
