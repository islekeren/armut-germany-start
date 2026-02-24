import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { QuotesService } from "./quotes.service";
import { CreateQuoteDto, UpdateQuoteDto, RespondToQuoteDto } from "./dto/quote.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("quotes")
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() createQuoteDto: CreateQuoteDto) {
    return this.quotesService.create(req.user.id, createQuoteDto);
  }

  @Get("my-quotes")
  @UseGuards(JwtAuthGuard)
  getMyQuotes(@Req() req: any) {
    return this.quotesService.findByProvider(req.user.id);
  }

  @Get("received")
  @UseGuards(JwtAuthGuard)
  getReceivedQuotes(@Req() req: any) {
    return this.quotesService.findByCustomer(req.user.id);
  }

  @Get("request/:requestId")
  @UseGuards(JwtAuthGuard)
  getByRequest(@Param("requestId") requestId: string, @Req() req: any) {
    return this.quotesService.findByRequest(requestId, req.user.id);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  findOne(@Param("id") id: string, @Req() req: any) {
    return this.quotesService.findOne(id, req.user.id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  update(
    @Param("id") id: string,
    @Req() req: any,
    @Body() updateQuoteDto: UpdateQuoteDto
  ) {
    return this.quotesService.update(id, req.user.id, updateQuoteDto);
  }

  @Post(":id/respond")
  @UseGuards(JwtAuthGuard)
  respond(
    @Param("id") id: string,
    @Req() req: any,
    @Body() respondDto: RespondToQuoteDto
  ) {
    return this.quotesService.respond(id, req.user.id, respondDto.action);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  withdraw(@Param("id") id: string, @Req() req: any) {
    return this.quotesService.withdraw(id, req.user.id);
  }
}
