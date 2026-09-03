import type {
  ChannelType,
  IOmnichannelAck,
  IOmnichannelMessage,
  OmnichannelMessageType,
} from "./omnichannel.js";

/** Comando neutro para enviar un mensaje saliente a través de cualquier canal. */
export interface SendOutboundCommand {
  conversationRef: string;
  type: Extract<OmnichannelMessageType, "text" | "image" | "document" | "audio" | "video">;
  text?: string;
  media?: {
    /** URL pública que el gateway pueda descargar (opcional si hay base64). */
    url?: string;
    /** Base64 crudo (sin prefijo data:); OpenWA lo acepta nativo. */
    base64?: string;
    mimeType?: string;
    filename?: string;
    caption?: string;
  };
  /** Permite correlacionar el ack/echo posterior con el mensaje local. */
  clientRef?: string;
}

export type InboundMessageHandler = (message: IOmnichannelMessage) => void | Promise<void>;
export type AckHandler = (ack: IOmnichannelAck) => void | Promise<void>;
export type ConnectionStateHandler = (state: ChannelConnectionState) => void;

export type ChannelConnectionState =
  | "initializing"
  | "qr_required"
  | "authenticated"
  | "connected"
  | "disconnected"
  | "error";

/**
 * Puerto del Channel Adapter. Un adaptador concreto (OpenWA, Cloud API)
 * implementa esta interfaz. El resto del sistema solo depende de ella.
 */
export interface IChannelAdapter {
  readonly channelType: ChannelType;
  readonly sessionName: string;

  /** Inicializa la conexión con el proveedor. */
  start(): Promise<void>;

  /** Cierra de forma ordenada la conexión. */
  stop(): Promise<void>;

  /** Envía un mensaje saliente y devuelve el id nativo del proveedor. */
  sendMessage(command: SendOutboundCommand): Promise<{ providerMessageId: string }>;

  /** Suscribe un handler para mensajes entrantes ya normalizados. */
  onMessage(handler: InboundMessageHandler): void;

  /** Suscribe un handler para acuses de recibo (sent/delivered/read/failed). */
  onAck(handler: AckHandler): void;

  /** Suscribe cambios de estado de conexión (incluye QR requerido). */
  onConnectionState(handler: ConnectionStateHandler): void;

  /** Último QR emitido (base64/dataURL) si el canal lo requiere. */
  getQr(): string | null;

  isReady(): boolean;
}

/** Registro de adaptadores disponibles, indexado por tipo de canal. */
export interface IChannelRegistry {
  register(adapter: IChannelAdapter): void;
  unregister(sessionName: string): void;
  get(channelType: ChannelType): IChannelAdapter;
  getDefault(): IChannelAdapter;
  getBySession(sessionName: string): IChannelAdapter | undefined;
  getNextForNewConversation(channelType: ChannelType): IChannelAdapter | undefined;
  all(): IChannelAdapter[];
}
