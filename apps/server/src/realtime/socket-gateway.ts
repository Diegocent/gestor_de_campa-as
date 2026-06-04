import type { Server as HttpServer } from "node:http";
import { Server as IOServer, type Socket } from "socket.io";
import type {
  ConversationUpdateEvent,
  IOmnichannelAck,
  NewMessageEvent,
  RealtimePublisher,
  TokenService,
} from "@gestor/core";

export const RT_EVENTS = {
  newMessage: "message:new",
  conversationUpdate: "conversation:update",
  ack: "message:ack",
  channelState: "channel:state",
} as const;

function roomFor(organizationId: string): string {
  return `org:${organizationId}`;
}

/**
 * Gateway de tiempo real. Autentica cada socket con el access token JWT y une
 * al agente a la sala de su organización. Implementa RealtimePublisher para que
 * los casos de uso emitan sin conocer socket.io.
 */
export class SocketGateway implements RealtimePublisher {
  private readonly io: IOServer;

  constructor(httpServer: HttpServer, tokenService: TokenService, corsOrigin: string) {
    this.io = new IOServer(httpServer, {
      cors: { origin: corsOrigin, credentials: true },
    });

    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("No autorizado"));
      try {
        const claims = tokenService.verifyAccess(token);
        socket.data.organizationId = claims.organizationId;
        socket.data.agentId = claims.sub;
        next();
      } catch {
        next(new Error("Token inválido"));
      }
    });

    this.io.on("connection", (socket: Socket) => {
      const organizationId = socket.data.organizationId as string;
      void socket.join(roomFor(organizationId));
    });
  }

  emitNewMessage(organizationId: string, payload: NewMessageEvent): void {
    this.io.to(roomFor(organizationId)).emit(RT_EVENTS.newMessage, payload);
  }

  emitConversationUpdate(organizationId: string, payload: ConversationUpdateEvent): void {
    this.io.to(roomFor(organizationId)).emit(RT_EVENTS.conversationUpdate, payload);
  }

  emitAck(organizationId: string, payload: IOmnichannelAck): void {
    this.io.to(roomFor(organizationId)).emit(RT_EVENTS.ack, payload);
  }

  /** Estado de conexión del canal (ej. QR requerido) para toda la organización. */
  emitChannelState(organizationId: string, state: string, qr: string | null): void {
    this.io.to(roomFor(organizationId)).emit(RT_EVENTS.channelState, { state, qr });
  }
}
