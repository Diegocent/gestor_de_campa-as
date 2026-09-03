import type {
  AckStatus,
  ChannelType,
  MessageDirection,
  OmnichannelMessageType,
} from "../channels/omnichannel.js";

export type AgentRole = "admin" | "agent";

export interface Agent {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: AgentRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Agente con el hash de contraseña (solo capa de datos/auth, nunca al frontend). */
export interface AgentWithSecret extends Agent {
  passwordHash: string;
}

export interface Contact {
  id: string;
  organizationId: string;
  channelType: ChannelType;
  externalId: string;
  phone: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationStatus = "open" | "pending" | "resolved" | "snoozed";

export interface Conversation {
  id: string;
  organizationId: string;
  contactId: string;
  channelType: ChannelType;
  conversationRef: string;
  status: ConversationStatus;
  assignedAgentId: string | null;
  /** Para ordenamiento dinámico del sidebar (epoch ms del último mensaje). */
  lastMessageAt: Date;
  lastMessagePreview: string | null;
  unreadCount: number;
  /** Nombre de sesión del adaptador que maneja esta conversación (multi-número). */
  channelSessionId?: string;
  /** Nombre de agenda / pushName del contacto (si se conoce). */
  contactName?: string | null;
  /** Teléfono del contacto (para mostrar bajo el nombre). */
  contactPhone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type StoredMessageStatus = "queued" | AckStatus;

export interface StoredMessage {
  id: string;
  organizationId: string;
  conversationId: string;
  providerMessageId: string | null;
  direction: MessageDirection;
  type: OmnichannelMessageType;
  text: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  status: StoredMessageStatus;
  /** Agente que lo envió (null si es del cliente o de un bot). */
  sentByAgentId: string | null;
  createdAt: Date;
}
