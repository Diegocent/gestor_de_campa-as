import {
  fromWhatsAppId,
  normalizePhoneNumber,
  type AckStatus,
  type IOmnichannelAck,
  type IOmnichannelMessage,
  type OmnichannelMessageType,
} from "@gestor/core";

const CHANNEL = "whatsapp_unofficial" as const;

/**
 * Forma "IncomingMessage" del gateway OpenWA (misma forma para message.received
 * y message.sent, ver docs/06-api-specification.md §6.6). La declaramos acá
 * para no acoplarnos al SDK oficial del gateway.
 */
export interface GatewayMessage {
  id: string;
  from: string;
  to?: string;
  chatId: string;
  body?: string;
  type: string;
  /** Epoch en SEGUNDOS. */
  timestamp: number;
  fromMe: boolean;
  isGroup?: boolean;
  /** Solo presente cuando el sender es un @lid y RESOLVE_LID_TO_PHONE=true. */
  senderPhone?: string | null;
  contact?: { name?: string; pushName?: string; number?: string };
  media?: { mimetype?: string; filename?: string; sizeBytes?: number };
}

/** Payload de message.ack / message.failed. */
export interface GatewayAckData {
  id: string;
  messageId: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  ack: number;
}

function mapType(gatewayType: string): OmnichannelMessageType {
  switch (gatewayType) {
    case "text":
      return "text";
    case "image":
      return "image";
    case "audio":
    case "voice":
      return "audio";
    case "video":
      return "video";
    case "document":
      return "document";
    case "location":
      return "location";
    default:
      return "system";
  }
}

/** El gateway ya entrega un status canónico; solo lo angostamos a nuestro tipo. */
export function mapAckStatus(status: GatewayAckData["status"]): AckStatus {
  if (status === "failed") return "failed";
  if (status === "read") return "read";
  if (status === "delivered") return "delivered";
  return "sent"; // "pending" | "sent"
}

function resolvePhone(chatId: string, senderPhone?: string | null): string {
  const raw = senderPhone || fromWhatsAppId(chatId);
  const normalized = normalizePhoneNumber(raw);
  if (normalized) return normalized.slice(0, 64);
  // Baileys/LID u otros JIDs: nos quedamos con dígitos acotados (nunca crashear el varchar).
  const digits = raw.replace(/\D/g, "").slice(0, 64);
  return digits || raw.slice(0, 64);
}

/** Traduce un IncomingMessage del gateway OpenWA al contrato omnichannel. */
export function toOmnichannelMessage(m: GatewayMessage, sessionName?: string): IOmnichannelMessage {
  // En fromMe el gateway a menudo manda tu propio pushName (perfil vinculado)
  // como contact.name. Eso NO es el cliente: nunca lo usamos para nombrar el chat.
  const clientName = m.fromMe
    ? undefined
    : (m.contact?.name ?? m.contact?.pushName);

  return {
    channelType: CHANNEL,
    providerMessageId: m.id,
    conversationRef: m.chatId,
    contact: {
      externalId: m.chatId,
      phone: resolvePhone(m.chatId, m.fromMe ? null : m.senderPhone),
      name: clientName,
    },
    direction: m.fromMe ? "outbound" : "inbound",
    type: mapType(m.type),
    text: m.body || undefined,
    media: m.media
      ? {
          mimeType: m.media.mimetype,
          filename: m.media.filename,
          caption: m.body || undefined,
          sizeBytes: m.media.sizeBytes,
        }
      : undefined,
    timestamp: m.timestamp * 1000,
    sessionName,
  };
}

/** Traduce un evento message.ack/message.failed del gateway al contrato omnichannel. */
export function toOmnichannelAck(data: GatewayAckData, chatId?: string): IOmnichannelAck {
  return {
    channelType: CHANNEL,
    providerMessageId: data.messageId,
    conversationRef: chatId ?? "",
    status: mapAckStatus(data.status),
    timestamp: Date.now(),
  };
}
