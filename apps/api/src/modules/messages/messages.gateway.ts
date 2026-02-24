import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { MessagesService } from "./messages.service";
import { SendMessageDto } from "./dto/message.dto";

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/messages",
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds

  constructor(
    private jwtService: JwtService,
    private messagesService: MessagesService
  ) {}

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token = socket.handshake.auth.token ||
                    socket.handshake.headers.authorization?.split(" ")[1];

      if (!token) {
        socket.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      socket.userId = payload.sub;

      // Add socket to user's connections
      const userSockets = this.connectedUsers.get(socket.userId) || [];
      userSockets.push(socket.id);
      this.connectedUsers.set(socket.userId, userSockets);

      // Join user's personal room
      socket.join(`user:${socket.userId}`);

      console.log(`User ${socket.userId} connected with socket ${socket.id}`);
    } catch (error) {
      console.error("Socket authentication failed:", error);
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    if (socket.userId) {
      const userSockets = this.connectedUsers.get(socket.userId) || [];
      const updatedSockets = userSockets.filter((id) => id !== socket.id);

      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(socket.userId);
      } else {
        this.connectedUsers.set(socket.userId, updatedSockets);
      }

      console.log(`User ${socket.userId} disconnected`);
    }
  }

  @SubscribeMessage("joinConversation")
  async handleJoinConversation(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() conversationId: string
  ) {
    if (!socket.userId) return;

    try {
      // Verify user is participant
      await this.messagesService.getConversation(conversationId, socket.userId);
      socket.join(`conversation:${conversationId}`);

      return { success: true };
    } catch (error) {
      return { success: false, error: "Access denied" };
    }
  }

  @SubscribeMessage("leaveConversation")
  handleLeaveConversation(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() conversationId: string
  ) {
    socket.leave(`conversation:${conversationId}`);
    return { success: true };
  }

  @SubscribeMessage("sendMessage")
  async handleSendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto
  ) {
    if (!socket.userId) return;

    try {
      const message = await this.messagesService.sendMessage(socket.userId, data);

      // Emit to all participants in the conversation
      this.server
        .to(`conversation:${data.conversationId}`)
        .emit("newMessage", message);

      // Also emit to user rooms for notifications
      const conversation = await this.messagesService.getConversation(
        data.conversationId,
        socket.userId
      );

      conversation.participants.forEach((participant) => {
        if (participant.userId !== socket.userId) {
          this.server.to(`user:${participant.userId}`).emit("messageNotification", {
            conversationId: data.conversationId,
            message,
          });
        }
      });

      return { success: true, message };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage("markAsRead")
  async handleMarkAsRead(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() conversationId: string
  ) {
    if (!socket.userId) return;

    try {
      await this.messagesService.markAsRead(conversationId, socket.userId);

      // Notify other participants that messages were read
      this.server.to(`conversation:${conversationId}`).emit("messagesRead", {
        conversationId,
        readBy: socket.userId,
        readAt: new Date(),
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage("typing")
  handleTyping(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean }
  ) {
    if (!socket.userId) return;

    socket.to(`conversation:${data.conversationId}`).emit("userTyping", {
      userId: socket.userId,
      isTyping: data.isTyping,
    });
  }

  // Method to send notifications from other services
  sendNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit("notification", notification);
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
}
