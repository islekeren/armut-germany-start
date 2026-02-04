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
import { ProvidersService } from "./providers.service";
import {
  CreateProviderDto,
  UpdateProviderDto,
  ApproveProviderDto,
  ProviderQueryDto,
  ProviderRequestsQueryDto,
  ProviderBookingsQueryDto,
  ProviderReviewsQueryDto,
  ReplyToReviewDto,
} from "./dto/provider.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("providers")
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() createProviderDto: CreateProviderDto) {
    return this.providersService.create(req.user.id, createProviderDto);
  }

  @Get()
  findAll(@Query() query: ProviderQueryDto) {
    return this.providersService.findAll(query);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  getMyProfile(@Req() req: any) {
    return this.providersService.findByUserId(req.user.id);
  }

  @Get("me/stats")
  @UseGuards(JwtAuthGuard)
  getMyStats(@Req() req: any) {
    return this.providersService.getStats(req.user.id);
  }

  @Get("me/dashboard")
  @UseGuards(JwtAuthGuard)
  getMyDashboard(@Req() req: any) {
    return this.providersService.getDashboard(req.user.id);
  }

  @Get("me/requests")
  @UseGuards(JwtAuthGuard)
  getMyRequests(@Req() req: any, @Query() query: ProviderRequestsQueryDto) {
    return this.providersService.getRequests(req.user.id, query);
  }

  @Get("me/bookings")
  @UseGuards(JwtAuthGuard)
  getMyBookings(@Req() req: any, @Query() query: ProviderBookingsQueryDto) {
    return this.providersService.getBookings(req.user.id, query);
  }

  @Get("me/reviews")
  @UseGuards(JwtAuthGuard)
  getMyReviews(@Req() req: any, @Query() query: ProviderReviewsQueryDto) {
    return this.providersService.getReviews(req.user.id, query);
  }

  @Post("me/reviews/:reviewId/reply")
  @UseGuards(JwtAuthGuard)
  replyToReview(
    @Req() req: any,
    @Param("reviewId") reviewId: string,
    @Body() body: ReplyToReviewDto
  ) {
    return this.providersService.replyToReview(req.user.id, reviewId, body.reply);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.providersService.findOne(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  update(
    @Param("id") id: string,
    @Req() req: any,
    @Body() updateProviderDto: UpdateProviderDto
  ) {
    return this.providersService.update(id, req.user.id, updateProviderDto);
  }

  @Patch(":id/approve")
  @UseGuards(JwtAuthGuard)
  approve(@Param("id") id: string, @Body() approveDto: ApproveProviderDto) {
    // TODO: Add admin guard
    return this.providersService.approve(id, approveDto.isApproved);
  }
}
