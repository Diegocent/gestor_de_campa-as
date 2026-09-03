import type {
  Agent,
  AgentWithSecret,
  Campaign,
  CampaignMessage,
  Contact,
  Conversation,
  StoredMessage,
} from "@gestor/core";
import type {
  AgentRow,
  CampaignMessageRow,
  CampaignRow,
  ContactRow,
  ConversationRow,
  MessageRow,
} from "./schema.js";

export function mapAgentWithSecret(row: AgentRow): AgentWithSecret {
  return { ...mapAgent(row), passwordHash: row.passwordHash };
}

export function mapAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapContact(row: ContactRow): Contact {
  return {
    id: row.id,
    organizationId: row.organizationId,
    channelType: row.channelType,
    externalId: row.externalId,
    phone: row.phone,
    name: row.name,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapConversation(
  row: ConversationRow,
  contact?: { name?: string | null; phone?: string | null }
): Conversation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    contactId: row.contactId,
    channelType: row.channelType,
    conversationRef: row.conversationRef,
    status: row.status,
    assignedAgentId: row.assignedAgentId,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview,
    unreadCount: row.unreadCount,
    channelSessionId: row.channelSessionId ?? undefined,
    contactName: contact?.name ?? null,
    contactPhone: contact?.phone ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    messageBody: row.messageBody,
    scheduledAt: row.scheduledAt,
    status: row.status,
    totalRecipients: row.totalRecipients,
    sentCount: row.sentCount,
    failedCount: row.failedCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapCampaignMessage(row: CampaignMessageRow): CampaignMessage {
  return {
    id: row.id,
    campaignId: row.campaignId,
    phone: row.phone,
    recipientName: row.recipientName,
    messageBody: row.messageBody,
    status: row.status,
    providerMessageId: row.providerMessageId,
    lastError: row.lastError,
  };
}

export function mapMessage(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    organizationId: row.organizationId,
    conversationId: row.conversationId,
    providerMessageId: row.providerMessageId,
    direction: row.direction,
    type: row.type,
    text: row.text,
    mediaUrl: row.mediaUrl,
    mediaMimeType: row.mediaMimeType,
    mediaFilename: row.mediaFilename,
    status: row.status,
    sentByAgentId: row.sentByAgentId,
    createdAt: row.createdAt,
  };
}
