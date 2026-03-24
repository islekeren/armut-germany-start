import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

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
}

