import type { IChannelRegistry } from "../../domain/channels/adapter.js";
import type { IOmnichannelMessage } from "../../domain/channels/omnichannel.js";
import { normalizePhoneNumber, toWhatsAppId } from "../../domain/phone.js";
import type { Conversation } from "../../domain/inbox/entities.js";
import type {
  ContactRepository,
  ConversationRepository,
} from "../ports.js";
import type { SendAgentMessageUseCase } from "./send-agent-message.js";

export interface StartConversationInput {
  organizationId: string;
  agentId: string;
  phone: string;
  /** Mensaje inicial opcional. */
  text?: string;
  /** Sesión WhatsApp a usar; si no, round-robin entre las listas. */
  sessionName?: string;
}

/**
 * Inicia (o reabre) una conversación hacia un número, sin que el contacto
 * haya escrito antes. OpenWA acepta send-text a cualquier chatId @c.us.
 */
export class StartConversationUseCase {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly conversations: ConversationRepository,
    private readonly channels: IChannelRegistry,
    private readonly sendAgentMessage: SendAgentMessageUseCase
  ) {}

  async execute(input: StartConversationInput): Promise<Conversation> {
    const phone = normalizePhoneNumber(input.phone);
    if (!phone) throw new Error("Número inválido");

    const conversationRef = toWhatsAppId(phone);

    const adapter = input.sessionName
      ? this.channels.getBySession(input.sessionName)
      : (this.channels.getNextForNewConversation("whatsapp_unofficial") ??
        this.channels.get("whatsapp_unofficial"));

    if (!adapter) throw new Error("No hay canal WhatsApp disponible");
    if (!adapter.isReady()) throw new Error("WhatsApp no está conectado");

    const seed: IOmnichannelMessage = {
      channelType: "whatsapp_unofficial",
      providerMessageId: `seed-${conversationRef}-${Date.now()}`,
      conversationRef,
      contact: {
        externalId: conversationRef,
        phone,
      },
      direction: "outbound",
      type: "text",
      text: input.text?.trim() || undefined,
      timestamp: Date.now(),
      sessionName: adapter.sessionName,
    };

    const contact = await this.contacts.upsertFromInbound(input.organizationId, seed);

    let conversation =
      (await this.conversations.findByRef(input.organizationId, conversationRef)) ??
      (await this.conversations.findOrCreate({
        organizationId: input.organizationId,
        contactId: contact.id,
        message: seed,
        channelSessionId: adapter.sessionName,
      }));

    // Si la conversación ya existía sin session, no forzamos overwrite aquí;
    // el envío usará channelSessionId o el default del canal.
    const text = input.text?.trim();
    if (text) {
      await this.sendAgentMessage.execute({
        organizationId: input.organizationId,
        conversationId: conversation.id,
        agentId: input.agentId,
        text,
      });
      conversation =
        (await this.conversations.findById(conversation.id)) ?? conversation;
    }

    return conversation;
  }
}
