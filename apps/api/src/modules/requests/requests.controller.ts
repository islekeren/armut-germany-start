import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { RequestsService } from "./requests.service";
import { CreateRequestDto, UpdateRequestDto, RequestQueryDto } from "./dto/request.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("requests")
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() createRequestDto: CreateRequestDto) {
    return this.requestsService.create(req.user.id, createRequestDto);
  }

  @Get()
  findAll(@Query() query: RequestQueryDto) {
    return this.requestsService.findAll(query);
  }

  @Get("my")
  @UseGuards(JwtAuthGuard)
  getMyRequests(@Req() req: any, @Query("status") status?: string) {
    return this.requestsService.findByCustomer(req.user.id, status);
  }

  @Get("for-provider/:providerId")
  @UseGuards(JwtAuthGuard)
  getForProvider(
    @Param("providerId") providerId: string,
    @Query() query: RequestQueryDto
  ) {
    return this.requestsService.getForProvider(providerId, query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.requestsService.findOne(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  update(
    @Param("id") id: string,
    @Req() req: any,
    @Body() updateRequestDto: UpdateRequestDto
  ) {
    return this.requestsService.update(id, req.user.id, updateRequestDto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  cancel(@Param("id") id: string, @Req() req: any) {
    return this.requestsService.cancel(id, req.user.id);
  }
}
