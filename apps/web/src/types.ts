// Tipos espejo del contrato del backend (no se acopla a openwa).
export interface Agent {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: "admin" | "agent";
  isActive: boolean;
}

export interface MessageTemplate {
  id: string;
  organizationId: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelSession {
  sessionName: string;
  channelType: string;
  connected: boolean;
  qr: string | null;
}

export interface Conversation {
  id: string;
  conversationRef: string;
  status: "open" | "pending" | "resolved" | "snoozed";
  assignedAgentId: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  contactName?: string | null;
  contactPhone?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  providerMessageId: string | null;
  direction: "inbound" | "outbound";
  type: string;
  text: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  sentByAgentId?: string | null;
  createdAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  messageBody: string;
  scheduledAt: string;
  status: "scheduled" | "processing" | "completed" | "partially_failed" | "cancelled";
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface SendRate {
  maxMessages: number;
  durationMinutes: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface NewMessageEvent {
  conversation: Conversation;
  message: Message;
}

export interface AckEvent {
  providerMessageId: string;
  conversationRef: string;
  status: Message["status"];
}

export interface ChannelStateEvent {
  state: string;
  qr: string | null;
}
