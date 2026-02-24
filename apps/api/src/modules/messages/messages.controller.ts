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
import { MessagesService } from "./messages.service";
import { CreateConversationDto, SendMessageDto, MarkAsReadDto } from "./dto/message.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("messages")
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post("conversations")
  createConversation(
    @Req() req: any,
    @Body() createConversationDto: CreateConversationDto
  ) {
    return this.messagesService.createConversation(
      req.user.id,
      createConversationDto
    );
  }

  @Get("conversations")
  getConversations(@Req() req: any) {
    return this.messagesService.getConversations(req.user.id);
  }

  @Get("conversations/:id")
  getConversation(@Param("id") id: string, @Req() req: any) {
    return this.messagesService.getConversation(id, req.user.id);
  }

  @Get("conversations/:id/messages")
  getMessages(
    @Param("id") id: string,
    @Req() req: any,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ) {
    return this.messagesService.getMessages(
      id,
      req.user.id,
      page || 1,
      limit || 50
    );
  }

  @Post("send")
  sendMessage(@Req() req: any, @Body() sendMessageDto: SendMessageDto) {
    return this.messagesService.sendMessage(req.user.id, sendMessageDto);
  }

  @Post("read")
  markAsRead(@Req() req: any, @Body() markAsReadDto: MarkAsReadDto) {
    return this.messagesService.markAsRead(
      markAsReadDto.conversationId,
      req.user.id
    );
  }

  @Get("unread-count")
  getUnreadCount(@Req() req: any) {
    return this.messagesService.getUnreadCount(req.user.id);
  }
}
