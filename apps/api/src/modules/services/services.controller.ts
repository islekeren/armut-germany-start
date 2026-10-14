import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateServiceDto, UpdateServiceDto } from "./dto/service.dto";
import { ServicesService } from "./services.service";

@Controller("services")
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  findAll(@Req() req: { user: { id: string } }) {
    return this.services.findAll(req.user.id);
  }

  @Post()
  create(@Req() req: { user: { id: string } }, @Body() dto: CreateServiceDto) {
    return this.services.create(req.user.id, dto);
  }

  @Patch(":id")
  update(
    @Req() req: { user: { id: string } },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.services.update(req.user.id, id, dto);
  }

  @Delete(":id")
  remove(
    @Req() req: { user: { id: string } },
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.services.remove(req.user.id, id);
  }
}
