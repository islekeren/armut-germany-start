import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import {
  CreateBookingDto,
  UpdateBookingDto,
  CreateReviewDto,
  ProviderReplyDto,
  BookingQueryDto,
} from "./dto/booking.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(req.user.id, createBookingDto);
  }

  @Get("customer")
  @UseGuards(JwtAuthGuard)
  getCustomerBookings(@Req() req: any, @Query() query: BookingQueryDto) {
    return this.bookingsService.findByCustomer(req.user.id, query);
  }

  @Get("provider")
  @UseGuards(JwtAuthGuard)
  getProviderBookings(@Req() req: any, @Query() query: BookingQueryDto) {
    return this.bookingsService.findByProvider(req.user.id, query);
  }

  @Get("upcoming/customer")
  @UseGuards(JwtAuthGuard)
  getUpcomingCustomer(@Req() req: any) {
    return this.bookingsService.getUpcoming(req.user.id, "customer");
  }

  @Get("upcoming/provider")
  @UseGuards(JwtAuthGuard)
  getUpcomingProvider(@Req() req: any) {
    return this.bookingsService.getUpcoming(req.user.id, "provider");
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(@Param("id") id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @Param("id") id: string,
    @Req() req: any,
    @Body() updateDto: UpdateBookingDto
  ) {
    return this.bookingsService.updateStatus(id, req.user.id, updateDto.status!);
  }

  @Patch(":id/reschedule")
  @UseGuards(JwtAuthGuard)
  reschedule(
    @Param("id") id: string,
    @Req() req: any,
    @Body("scheduledDate") scheduledDate: string
  ) {
    return this.bookingsService.reschedule(id, req.user.id, scheduledDate);
  }

  @Post(":id/review")
  @UseGuards(JwtAuthGuard)
  createReview(
    @Param("id") id: string,
    @Req() req: any,
    @Body() createReviewDto: CreateReviewDto
  ) {
    return this.bookingsService.createReview(id, req.user.id, createReviewDto);
  }

  @Post(":id/reply")
  @UseGuards(JwtAuthGuard)
  addProviderReply(
    @Param("id") id: string,
    @Req() req: any,
    @Body() replyDto: ProviderReplyDto
  ) {
    return this.bookingsService.addProviderReply(
      id,
      req.user.id,
      replyDto.reply,
      replyDto.replyImages,
    );
  }
}
