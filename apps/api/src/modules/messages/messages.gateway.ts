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
import { type OnModuleDestroy } from "@nestjs/common";
import { MessagesService } from "./messages.service";
import { SendMessageDto } from "./dto/message.dto";
import { UsersService } from "../users/users.service";
import { accountEvents } from "../../common/security/account-events";
import { isAllowedOrigin } from "../../common/security/cors-origin";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  expiresAt?: number;
  authentication?: Promise<boolean>;
}

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  },
  allowRequest: (request, callback) => callback(null, isAllowedOrigin(request.headers.origin)),
  namespace: "/messages",
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private connectedUsers: Map<string, string[]> = new Map(); // userId -> socketIds
  private sessions = new Map<string, { socket: AuthenticatedSocket; timer: ReturnType<typeof setTimeout> }>();
  private eventBudgets = new Map<string, { resetAt: number; count: number }>();
  private readonly onAccountDeleted = (userId: string) => {
    for (const id of this.connectedUsers.get(userId) || []) {
      this.sessions.get(id)?.socket.disconnect(true);
    }
  };

  constructor(
    private jwtService: JwtService,
    private messagesService: MessagesService,
    private usersService: UsersService,
  ) {
    accountEvents.on("deleted", this.onAccountDeleted);
  }

  async handleConnection(socket: AuthenticatedSocket) {
    // An event emitted immediately after connect must await authentication,
    // including the active-account lookup, before it can join any room.
    socket.authentication = this.authenticateConnection(socket);
    await socket.authentication;
  }

  private async authenticateConnection(socket: AuthenticatedSocket) {
    try {
      const token = socket.handshake.auth.token ||
                    socket.handshake.headers.authorization?.split(" ")[1];

      if (typeof token !== "string" || !token) throw new Error("Invalid token");
      const payload = this.jwtService.verify(token, { algorithms: ["HS256"] });
      if (typeof payload.sub !== "string" || !payload.sub || !Number.isSafeInteger(payload.exp)) {
        throw new Error("Invalid claims");
      }
      const user = await this.usersService.findById(payload.sub);
      const expiresAt = payload.exp * 1000;
      if (!user || expiresAt <= Date.now() || !socket.connected) throw new Error("Invalid account");
      if ((this.connectedUsers.get(payload.sub)?.length || 0) >= 10) throw new Error("Connection limit");
      socket.userId = payload.sub;
      socket.expiresAt = expiresAt;

      // Add socket to user's connections
      const userSockets = this.connectedUsers.get(socket.userId) || [];
      userSockets.push(socket.id);
      this.connectedUsers.set(socket.userId, userSockets);

      const timer = setTimeout(() => socket.disconnect(true), Math.min(expiresAt - Date.now(), 2_147_483_647));
      timer.unref();
      this.sessions.set(socket.id, { socket, timer });
      // Register revocation before awaiting room membership or another lookup.
      // A deletion racing with authentication must not miss this session.
      if (!await this.usersService.findById(payload.sub) || !socket.connected || expiresAt <= Date.now()) {
        throw new Error("Revoked during authentication");
      }
      socket.data.userId = socket.userId;
      socket.data.expiresAt = expiresAt;
      await socket.join(`user:${socket.userId}`);
      return true;
    } catch {
      // Do not log untrusted tokens, claims, or authentication errors.
      socket.disconnect(true);
      return false;
    }
  }

  private async authorizeEvent(socket: AuthenticatedSocket): Promise<string | null> {
    if (!await socket.authentication || !socket.userId || !socket.expiresAt || socket.expiresAt <= Date.now() || !socket.connected) {
      socket.disconnect(true);
      return "Authentication expired or revoked";
    }
    const now = Date.now();
    for (const [userId, budget] of this.eventBudgets) {
      if (budget.resetAt <= now) this.eventBudgets.delete(userId);
    }
    const budget = this.eventBudgets.get(socket.userId) || { resetAt: now + 60_000, count: 0 };
    budget.count += 1;
    this.eventBudgets.set(socket.userId, budget);
    if (budget.count > 100) return "Too many socket events. Try again later.";
    try {
      const user = await this.usersService.findById(socket.userId);
      if (!user || socket.expiresAt <= Date.now() || !socket.connected) throw new Error("Revoked account");
      return null;
    } catch {
      socket.disconnect(true);
      return "Authentication expired or revoked";
    }
  }

  private async emitToRoom(
    room: string, event: string, payload: unknown,
    participantIds: string[], excludeSocketId?: string,
  ) {
    // Recheck recipients too: a deletion performed on another API instance
    // must not leave an idle socket receiving messages from an old room.
    const active = new Set<string>();
    for (const userId of new Set(participantIds)) {
      if (await this.usersService.findById(userId)) active.add(userId);
    }
    const recipients = await this.server.in(room).fetchSockets();
    const allowed: string[] = [];
    for (const recipient of recipients) {
      const userId = recipient.data.userId;
      if (!active.has(userId) || !(recipient.data.expiresAt > Date.now())) {
        recipient.disconnect(true);
      } else if (recipient.id !== excludeSocketId) {
        allowed.push(recipient.id);
      }
    }
    if (allowed.length) this.server.to(allowed).emit(event, payload);
  }

  onModuleDestroy() {
    accountEvents.off("deleted", this.onAccountDeleted);
    for (const { socket, timer } of this.sessions.values()) {
      clearTimeout(timer);
      socket.disconnect(true);
    }
    this.sessions.clear();
    this.connectedUsers.clear();
    this.eventBudgets.clear();
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    const session = this.sessions.get(socket.id);
    if (session) clearTimeout(session.timer);
    this.sessions.delete(socket.id);
    if (socket.userId) {
      const userSockets = this.connectedUsers.get(socket.userId) || [];
      const updatedSockets = userSockets.filter((id) => id !== socket.id);

      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(socket.userId);
      } else {
        this.connectedUsers.set(socket.userId, updatedSockets);
      }

    }
  }

  @SubscribeMessage("joinConversation")
  async handleJoinConversation(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() conversationId: string
  ) {
    const error = await this.authorizeEvent(socket);
    if (error) return { success: false, error };

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
  async handleLeaveConversation(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() conversationId: string
  ) {
    const error = await this.authorizeEvent(socket);
    if (error) return { success: false, error };
    socket.leave(`conversation:${conversationId}`);
    return { success: true };
  }

  @SubscribeMessage("sendMessage")
  async handleSendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto
  ) {
    const error = await this.authorizeEvent(socket);
    if (error) return { success: false, error };

    try {
      const message = await this.messagesService.sendMessage(socket.userId, data);

      const conversation = await this.messagesService.getConversation(
        data.conversationId,
        socket.userId
      );

      await this.emitToRoom(`conversation:${data.conversationId}`, "newMessage", message,
        conversation.participants.map((participant) => participant.userId));

      for (const participant of conversation.participants) {
        if (participant.userId !== socket.userId) {
          await this.emitToRoom(`user:${participant.userId}`, "messageNotification", {
            conversationId: data.conversationId,
            message,
          }, [participant.userId]);
        }
      }

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
    const error = await this.authorizeEvent(socket);
    if (error) return { success: false, error };

    try {
      await this.messagesService.markAsRead(conversationId, socket.userId);

      const conversation = await this.messagesService.getConversation(conversationId, socket.userId);
      await this.emitToRoom(`conversation:${conversationId}`, "messagesRead", {
        conversationId,
        readBy: socket.userId,
        readAt: new Date(),
      }, conversation.participants.map((participant) => participant.userId));

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage("typing")
  async handleTyping(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean }
  ) {
    const error = await this.authorizeEvent(socket);
    if (error) return { success: false, error };
    if (typeof data?.conversationId !== "string" || typeof data?.isTyping !== "boolean") {
      return { success: false, error: "Invalid typing event" };
    }
    try {
      const conversation = await this.messagesService.getConversation(data.conversationId, socket.userId);
      await this.emitToRoom(`conversation:${data.conversationId}`, "userTyping", {
        userId: socket.userId,
        isTyping: data.isTyping,
      }, conversation.participants.map((participant) => participant.userId), socket.id);
      return { success: true };
    } catch {
      return { success: false, error: "Access denied" };
    }
  }

  // Method to send notifications from other services
  async sendNotification(userId: string, notification: any) {
    await this.emitToRoom(`user:${userId}`, "notification", notification, [userId]);
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
}
