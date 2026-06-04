import type { IChannelRegistry } from "../../domain/channels/adapter.js";
import type {
  ConversationRepository,
  InboxMessageRepository,
  RealtimePublisher,
} from "../ports.js";

export interface SendAgentMessageInput {
  organizationId: string;
  conversationId: string;
  agentId: string;
  text: string;
}

/**
 * Un agente humano envía un mensaje en una conversación. Se delega el envío al
 * Channel Adapter correspondiente y se persiste/propaga el resultado.
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

    const adapter = this.channels.get(conversation.channelType);
    const { providerMessageId } = await adapter.sendMessage({
      conversationRef: conversation.conversationRef,
      type: "text",
      text: input.text,
    });

    const stored = await this.messages.insertOutbound({
      organizationId: input.organizationId,
      conversationId: conversation.id,
      sentByAgentId: input.agentId,
      type: "text",
      text: input.text,
      providerMessageId,
    });

    const updated = await this.conversations.registerActivity({
      conversationId: conversation.id,
      lastMessageAt: new Date(),
      preview: input.text.slice(0, 140),
      incrementUnread: false,
    });

    this.realtime.emitNewMessage(input.organizationId, {
      conversation: updated,
      message: stored,
    });
  }
}
