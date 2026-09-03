import type { IOmnichannelMessage } from "../../domain/channels/omnichannel.js";
import type {
  ContactRepository,
  ConversationRepository,
  InboxMessageRepository,
  RealtimePublisher,
} from "../ports.js";

function previewOf(message: IOmnichannelMessage): string {
  if (message.text) return message.text.slice(0, 140);
  if (message.media?.caption) return message.media.caption.slice(0, 140);
  return `[${message.type}]`;
}

/**
 * Ingesta de un mensaje entrante ya normalizado por un Channel Adapter.
 * Es idempotente: si el providerMessageId ya existe, no duplica.
 */
export class IngestInboundMessageUseCase {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly conversations: ConversationRepository,
    private readonly messages: InboxMessageRepository,
    private readonly realtime: RealtimePublisher
  ) {}

  async execute(organizationId: string, message: IOmnichannelMessage): Promise<void> {
    if (await this.messages.existsByProviderId(message.providerMessageId)) {
      return;
    }

    const contact = await this.contacts.upsertFromInbound(organizationId, message);

    const conversation = await this.conversations.findOrCreate({
      organizationId,
      contactId: contact.id,
      message,
      channelSessionId: message.sessionName,
    });

    const stored = await this.messages.insertInbound(
      organizationId,
      conversation.id,
      message
    );

    const updated = await this.conversations.registerActivity({
      conversationId: conversation.id,
      lastMessageAt: new Date(message.timestamp),
      preview: previewOf(message),
      incrementUnread: message.direction === "inbound",
    });

    this.realtime.emitNewMessage(organizationId, {
      conversation: updated,
      message: stored,
    });
  }
}
