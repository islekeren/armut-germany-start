import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";
import { PushNotificationsService } from "./push-notifications.service";
import {
  RegisterPushTokenDto,
  UnregisterPushTokenDto,
} from "./dto/push-token.dto";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Get()
  list(
    @Req() req: any,
    @Query("onlyUnread") onlyUnread?: string,
    @Query("limit") limit?: string,
  ) {
    return this.notificationsService.list(
      req.user.id,
      onlyUnread === "true",
      limit ? Number(limit) : 100,
    );
  }

  @Get("unread-count")
  unreadCount(@Req() req: any) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Post(":id/read")
  markAsRead(@Req() req: any, @Param("id") id: string) {
    return this.notificationsService.markAsRead(req.user.id, id);
  }

  @Post("read-all")
  markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  @Post("push-token")
  registerPushToken(@Req() req: any, @Body() body: RegisterPushTokenDto) {
    return this.pushNotificationsService.registerToken(
      req.user.id,
      body.token,
      body.platform,
    );
  }

  @Delete("push-token")
  unregisterPushToken(@Req() req: any, @Body() body: UnregisterPushTokenDto) {
    return this.pushNotificationsService.unregisterToken(
      req.user.id,
      body.token,
    );
  }
}

