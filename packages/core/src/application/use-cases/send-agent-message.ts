import type { IChannelRegistry, SendOutboundCommand } from "../../domain/channels/adapter.js";
import type { OmnichannelMessageType } from "../../domain/channels/omnichannel.js";
import type {
  ConversationRepository,
  InboxMessageRepository,
  RealtimePublisher,
} from "../ports.js";

export interface SendAgentMessageInput {
  organizationId: string;
  conversationId: string;
  agentId: string;
  text?: string | null;
  media?: {
    /** Ruta relativa servida por el backend, ej. /media/uuid.jpg */
    storedUrl: string;
    base64: string;
    mimeType: string;
    filename: string;
  };
}

function mediaKind(mime: string): Extract<OmnichannelMessageType, "image" | "video" | "audio" | "document"> {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Un agente humano envía texto y/o multimedia en una conversación.
 */
export class SendAgentMessageUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly messages: InboxMessageRepository,
    private readonly channels: IChannelRegistry,
    private readonly realtime: RealtimePublisher
  ) {}

  async execute(input: SendAgentMessageInput): Promise<void> {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation || conversation.organizationId !== input.organizationId) {
      throw new Error("Conversación no encontrada");
    }

    const text = input.text?.trim() || null;
    if (!text && !input.media) {
      throw new Error("Mensaje vacío");
    }

    const adapter = conversation.channelSessionId
      ? (this.channels.getBySession(conversation.channelSessionId) ??
        this.channels.get(conversation.channelType))
      : this.channels.get(conversation.channelType);

    const type: SendOutboundCommand["type"] = input.media
      ? mediaKind(input.media.mimeType)
      : "text";

    const command: SendOutboundCommand = {
      conversationRef: conversation.conversationRef,
      type,
      text: text ?? undefined,
      media: input.media
        ? {
            base64: input.media.base64,
            mimeType: input.media.mimeType,
            filename: input.media.filename,
            caption: text ?? undefined,
          }
        : undefined,
    };

    const { providerMessageId } = await adapter.sendMessage(command);

    const preview =
      text?.slice(0, 140) ??
      (input.media ? `[${type}] ${input.media.filename}` : "[mensaje]");

    const stored = await this.messages.insertOutbound({
      organizationId: input.organizationId,
      conversationId: conversation.id,
      sentByAgentId: input.agentId,
      type,
      text,
      providerMessageId,
      mediaUrl: input.media?.storedUrl ?? null,
      mediaMimeType: input.media?.mimeType ?? null,
      mediaFilename: input.media?.filename ?? null,
    });

    // Si nadie la tenía, el que responde se queda como gestor asignado.
    if (!conversation.assignedAgentId) {
      await this.conversations.assign(conversation.id, input.agentId);
    }

    const updated = await this.conversations.registerActivity({
      conversationId: conversation.id,
      lastMessageAt: new Date(),
      preview,
      incrementUnread: false,
    });

    this.realtime.emitNewMessage(input.organizationId, {
      conversation: updated,
      message: stored,
    });
  }
}
