import type {
  IOmnichannelAck,
  IOmnichannelMessage,
} from "../domain/channels/omnichannel.js";
import type {
  Agent,
  AgentWithSecret,
  Contact,
  Conversation,
  ConversationStatus,
  StoredMessage,
} from "../domain/inbox/entities.js";
import type { Campaign, CampaignMessage } from "../domain/campaigns/entities.js";

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ContactRepository {
  upsertFromInbound(
    organizationId: string,
    message: IOmnichannelMessage
  ): Promise<Contact>;
  /** Actualiza nombres desde la agenda de WhatsApp (no borra si el nuevo es vacío). */
  upsertAgendaNames(
    organizationId: string,
    items: Array<{
      externalId: string;
      phone: string;
      name: string | null;
      avatarUrl?: string | null;
    }>
  ): Promise<void>;
}

export interface ConversationRepository {
  findOrCreate(input: {
    organizationId: string;
    contactId: string;
    message: IOmnichannelMessage;
    channelSessionId?: string;
  }): Promise<Conversation>;
  findById(id: string): Promise<Conversation | null>;
  findByRef(organizationId: string, conversationRef: string): Promise<Conversation | null>;
  registerActivity(input: {
    conversationId: string;
    lastMessageAt: Date;
    preview: string;
    incrementUnread: boolean;
  }): Promise<Conversation>;
  resetUnread(conversationId: string): Promise<void>;
  assign(conversationId: string, agentId: string | null): Promise<Conversation>;
  setStatus(conversationId: string, status: ConversationStatus): Promise<Conversation>;
  list(input: {
    organizationId: string;
    page: number;
    pageSize: number;
    status?: ConversationStatus;
    assignedAgentId?: string;
  }): Promise<Paginated<Conversation>>;
}

export interface InboxMessageRepository {
  insertInbound(
    organizationId: string,
    conversationId: string,
    message: IOmnichannelMessage
  ): Promise<StoredMessage>;
  insertOutbound(input: {
    organizationId: string;
    conversationId: string;
    sentByAgentId: string | null;
    type: StoredMessage["type"];
    text: string | null;
    providerMessageId: string | null;
    mediaUrl?: string | null;
    mediaMimeType?: string | null;
    mediaFilename?: string | null;
  }): Promise<StoredMessage>;
  updateStatusByProviderId(
    providerMessageId: string,
    status: StoredMessage["status"]
  ): Promise<void>;
  listByConversation(input: {
    conversationId: string;
    page: number;
    pageSize: number;
  }): Promise<Paginated<StoredMessage>>;
  existsByProviderId(providerMessageId: string): Promise<boolean>;
}

export interface AgentRepository {
  findByEmail(email: string): Promise<AgentWithSecret | null>;
  findById(id: string): Promise<Agent | null>;
  listByOrganization(organizationId: string): Promise<Agent[]>;
  create(input: {
    organizationId: string;
    email: string;
    name: string;
    passwordHash: string;
    role: Agent["role"];
  }): Promise<Agent>;
  update(id: string, input: {
    name?: string;
    role?: Agent["role"];
    isActive?: boolean;
    passwordHash?: string;
  }): Promise<Agent>;
}

/** Puerto de tiempo real: el adaptador concreto (socket.io) lo implementa. */
export interface RealtimePublisher {
  /** Emite a todos los agentes de la organización. */
  emitNewMessage(organizationId: string, payload: NewMessageEvent): void;
  emitConversationUpdate(organizationId: string, payload: ConversationUpdateEvent): void;
  emitAck(organizationId: string, payload: IOmnichannelAck): void;
  emitChannelState(organizationId: string, state: string, qr: string | null): void;
}

export interface NewMessageEvent {
  conversation: Conversation;
  message: StoredMessage;
}

export interface ConversationUpdateEvent {
  conversation: Conversation;
}

export interface NewCampaignMessage {
  phone: string;
  recipientName: string | null;
  messageBody: string;
}

export interface CampaignRepository {
  createCampaign(input: {
    organizationId: string;
    title: string;
    messageBody: string;
    scheduledAt: Date;
  }): Promise<Campaign>;
  /** Inserta un lote de mensajes (Bulk Create) y devuelve sus ids en orden. */
  insertMessagesBatch(
    campaignId: string,
    messages: NewCampaignMessage[]
  ): Promise<string[]>;
  finalizeTotals(campaignId: string, total: number): Promise<void>;
  getCampaign(organizationId: string, id: string): Promise<Campaign | null>;
  listCampaigns(input: {
    organizationId: string;
    page: number;
    pageSize: number;
  }): Promise<Paginated<Campaign>>;
  getMessageForSend(messageId: string): Promise<CampaignMessage | null>;
  markMessageSent(messageId: string, providerMessageId: string): Promise<void>;
  markMessageFailed(messageId: string, error: string): Promise<void>;
  cancelCampaign(organizationId: string, id: string): Promise<string[]>;
}

/** Encola el envío de un mensaje de campaña (BullMQ). */
export interface CampaignJobQueue {
  enqueueSend(input: {
    campaignMessageId: string;
    delayMs: number;
  }): Promise<void>;
  removeJobs(campaignMessageIds: string[]): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenClaims {
  sub: string;
  organizationId: string;
  role: Agent["role"];
}

export interface TokenService {
  issuePair(claims: AccessTokenClaims): TokenPair;
  verifyAccess(token: string): AccessTokenClaims;
  verifyRefresh(token: string): AccessTokenClaims;
}
