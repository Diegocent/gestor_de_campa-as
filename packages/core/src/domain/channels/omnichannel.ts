/**
 * Contrato omnichannel interno y estandarizado.
 *
 * Esta es la ÚNICA forma de mensaje que conocen los casos de uso, la base de
 * datos y el frontend. Cada proveedor (OpenWA hoy, WhatsApp Cloud API mañana)
 * tiene su propio adaptador que traduce su payload nativo a estas interfaces.
 */

export type ChannelType = "whatsapp_unofficial" | "whatsapp_cloud";

export type MessageDirection = "inbound" | "outbound";

export type OmnichannelMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "system";

export interface OmnichannelMedia {
  /** URL pública/firmada o ruta interna ya resuelta por el adaptador. */
  url?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  /** Tamaño en bytes si el proveedor lo informa. */
  sizeBytes?: number;
}

export interface OmnichannelContact {
  /** Identificador del contacto en el proveedor (ej. "595981...@c.us"). */
  externalId: string;
  /** Teléfono normalizado E.164 (sin "+"), ej. "595981123456". */
  phone: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Mensaje normalizado. Tanto inbound (cliente → nosotros) como outbound
 * (agente/bot → cliente) se representan con esta misma forma.
 */
export interface IOmnichannelMessage {
  channelType: ChannelType;
  /** ID nativo del mensaje en el proveedor (idempotencia). */
  providerMessageId: string;
  /** Referencia estable de la conversación (chatId normalizado). */
  conversationRef: string;
  contact: OmnichannelContact;
  direction: MessageDirection;
  type: OmnichannelMessageType;
  text?: string;
  media?: OmnichannelMedia;
  /** Epoch en milisegundos. */
  timestamp: number;
  /** Nombre de la sesión del adaptador que recibió/envió el mensaje. */
  sessionName?: string;
}

export type AckStatus = "sent" | "delivered" | "read" | "failed";

export interface IOmnichannelAck {
  channelType: ChannelType;
  providerMessageId: string;
  conversationRef: string;
  status: AckStatus;
  timestamp: number;
}
