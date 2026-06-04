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
 * Subconjunto de campos del Message de OpenWA que consumimos. Lo declaramos
 * localmente para NO acoplarnos a la forma exacta de los tipos de la librería
 * (cambian entre versiones). El adaptador castea el Message nativo a esto.
 */
export interface RawWaMessage {
  id: string;
  from: string;
  to?: string;
  body?: string;
  caption?: string;
  type: string;
  t?: number;
  fromMe?: boolean;
  mimetype?: string;
  filename?: string;
  notifyName?: string;
  ack?: number;
  sender?: { pushname?: string; formattedName?: string; id?: string };
}

function mapType(waType: string): OmnichannelMessageType {
  switch (waType) {
    case "chat":
      return "text";
    case "image":
      return "image";
    case "audio":
    case "ptt":
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

/** Códigos ack de WhatsApp: -1 error, 1 sent, 2 delivered, 3 read, 4 played. */
export function mapAckStatus(ack: number): AckStatus {
  if (ack < 0) return "failed";
  if (ack >= 3) return "read";
  if (ack === 2) return "delivered";
  return "sent";
}

function resolvePhone(chatId: string): string {
  return normalizePhoneNumber(fromWhatsAppId(chatId)) ?? fromWhatsAppId(chatId);
}

/** Traduce un Message nativo de OpenWA al contrato omnichannel. */
export function toOmnichannelMessage(m: RawWaMessage): IOmnichannelMessage {
  const conversationRef = String(m.from);
  return {
    channelType: CHANNEL,
    providerMessageId: String(m.id),
    conversationRef,
    contact: {
      externalId: conversationRef,
      phone: resolvePhone(conversationRef),
      name: m.sender?.pushname ?? m.notifyName ?? m.sender?.formattedName ?? undefined,
    },
    direction: m.fromMe ? "outbound" : "inbound",
    type: mapType(String(m.type)),
    text: m.body || m.caption || undefined,
    media: m.mimetype
      ? { mimeType: m.mimetype, filename: m.filename, caption: m.caption }
      : undefined,
    timestamp: (m.t ?? Math.floor(Date.now() / 1000)) * 1000,
  };
}

/** Traduce un evento de ack de OpenWA al contrato omnichannel. */
export function toOmnichannelAck(m: RawWaMessage): IOmnichannelAck {
  return {
    channelType: CHANNEL,
    providerMessageId: String(m.id),
    conversationRef: String(m.to ?? m.from),
    status: mapAckStatus(Number(m.ack ?? 0)),
    timestamp: Date.now(),
  };
}
