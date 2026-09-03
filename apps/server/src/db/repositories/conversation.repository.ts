import { and, count, desc, eq, sql } from "drizzle-orm";
import type {
  Conversation,
  ConversationRepository,
  ConversationStatus,
  IOmnichannelMessage,
  Paginated,
} from "@gestor/core";
import { db } from "../client.js";
import { contacts, conversations } from "../schema.js";
import { mapConversation } from "../mappers.js";

type JoinedRow = {
  conversation: typeof conversations.$inferSelect;
  contactName: string | null;
  contactPhone: string | null;
};

function mapJoined(row: JoinedRow): Conversation {
  return mapConversation(row.conversation, {
    name: row.contactName,
    phone: row.contactPhone,
  });
}

export class DrizzleConversationRepository implements ConversationRepository {
  private async withContactById(id: string): Promise<Conversation | null> {
    const [row] = await db
      .select({
        conversation: conversations,
        contactName: contacts.name,
        contactPhone: contacts.phone,
      })
      .from(conversations)
      .innerJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(eq(conversations.id, id))
      .limit(1);
    return row ? mapJoined(row) : null;
  }

  async findOrCreate(input: {
    organizationId: string;
    contactId: string;
    message: IOmnichannelMessage;
    channelSessionId?: string;
  }): Promise<Conversation> {
    const { organizationId, contactId, message, channelSessionId } = input;
    const [row] = await db
      .insert(conversations)
      .values({
        organizationId,
        contactId,
        channelType: message.channelType,
        conversationRef: message.conversationRef,
        lastMessageAt: new Date(message.timestamp),
        channelSessionId: channelSessionId ?? null,
      })
      .onConflictDoUpdate({
        target: [conversations.organizationId, conversations.conversationRef],
        set: { updatedAt: new Date() },
      })
      .returning();

    return (await this.withContactById(row!.id)) ?? mapConversation(row!);
  }

  async findById(id: string): Promise<Conversation | null> {
    return this.withContactById(id);
  }

  async findByRef(
    organizationId: string,
    conversationRef: string
  ): Promise<Conversation | null> {
    const [row] = await db
      .select({
        conversation: conversations,
        contactName: contacts.name,
        contactPhone: contacts.phone,
      })
      .from(conversations)
      .innerJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          eq(conversations.conversationRef, conversationRef)
        )
      )
      .limit(1);
    return row ? mapJoined(row) : null;
  }

  async registerActivity(input: {
    conversationId: string;
    lastMessageAt: Date;
    preview: string;
    incrementUnread: boolean;
  }): Promise<Conversation> {
    await db
      .update(conversations)
      .set({
        lastMessageAt: input.lastMessageAt,
        lastMessagePreview: input.preview,
        unreadCount: input.incrementUnread
          ? sql`${conversations.unreadCount} + 1`
          : conversations.unreadCount,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, input.conversationId));

    const updated = await this.withContactById(input.conversationId);
    if (!updated) throw new Error(`Conversación ${input.conversationId} no encontrada`);
    return updated;
  }

  async resetUnread(conversationId: string): Promise<void> {
    await db
      .update(conversations)
      .set({ unreadCount: 0, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  async assign(conversationId: string, agentId: string | null): Promise<Conversation> {
    await db
      .update(conversations)
      .set({ assignedAgentId: agentId, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    const updated = await this.withContactById(conversationId);
    if (!updated) throw new Error(`Conversación ${conversationId} no encontrada`);
    return updated;
  }

  async setStatus(
    conversationId: string,
    status: ConversationStatus
  ): Promise<Conversation> {
    await db
      .update(conversations)
      .set({ status, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    const updated = await this.withContactById(conversationId);
    if (!updated) throw new Error(`Conversación ${conversationId} no encontrada`);
    return updated;
  }

  async list(input: {
    organizationId: string;
    page: number;
    pageSize: number;
    status?: ConversationStatus;
    assignedAgentId?: string;
  }): Promise<Paginated<Conversation>> {
    const filters = [eq(conversations.organizationId, input.organizationId)];
    if (input.status) filters.push(eq(conversations.status, input.status));
    if (input.assignedAgentId) {
      filters.push(eq(conversations.assignedAgentId, input.assignedAgentId));
    }
    const where = and(...filters);

    const totals = await db
      .select({ total: count() })
      .from(conversations)
      .where(where);
    const totalCount = Number(totals[0]?.total ?? 0);

    const offset = (input.page - 1) * input.pageSize;
    const rows = await db
      .select({
        conversation: conversations,
        contactName: contacts.name,
        contactPhone: contacts.phone,
      })
      .from(conversations)
      .innerJoin(contacts, eq(conversations.contactId, contacts.id))
      .where(where)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(input.pageSize)
      .offset(offset);

    return {
      items: rows.map(mapJoined),
      total: totalCount,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: totalCount === 0 ? 1 : Math.ceil(totalCount / input.pageSize),
    };
  }
}
