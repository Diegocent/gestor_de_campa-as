import { and, count, desc, eq, sql } from "drizzle-orm";
import type {
  Conversation,
  ConversationRepository,
  ConversationStatus,
  IOmnichannelMessage,
  Paginated,
} from "@gestor/core";
import { db } from "../client.js";
import { conversations } from "../schema.js";
import { mapConversation } from "../mappers.js";

export class DrizzleConversationRepository implements ConversationRepository {
  async findOrCreate(input: {
    organizationId: string;
    contactId: string;
    message: IOmnichannelMessage;
  }): Promise<Conversation> {
    const { organizationId, contactId, message } = input;
    const [row] = await db
      .insert(conversations)
      .values({
        organizationId,
        contactId,
        channelType: message.channelType,
        conversationRef: message.conversationRef,
        lastMessageAt: new Date(message.timestamp),
      })
      .onConflictDoUpdate({
        target: [conversations.organizationId, conversations.conversationRef],
        set: { updatedAt: new Date() },
      })
      .returning();

    return mapConversation(row!);
  }

  async findById(id: string): Promise<Conversation | null> {
    const [row] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    return row ? mapConversation(row) : null;
  }

  async findByRef(
    organizationId: string,
    conversationRef: string
  ): Promise<Conversation | null> {
    const [row] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          eq(conversations.conversationRef, conversationRef)
        )
      )
      .limit(1);
    return row ? mapConversation(row) : null;
  }

  async registerActivity(input: {
    conversationId: string;
    lastMessageAt: Date;
    preview: string;
    incrementUnread: boolean;
  }): Promise<Conversation> {
    const [row] = await db
      .update(conversations)
      .set({
        lastMessageAt: input.lastMessageAt,
        lastMessagePreview: input.preview,
        unreadCount: input.incrementUnread
          ? sql`${conversations.unreadCount} + 1`
          : conversations.unreadCount,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, input.conversationId))
      .returning();
    return mapConversation(row!);
  }

  async resetUnread(conversationId: string): Promise<void> {
    await db
      .update(conversations)
      .set({ unreadCount: 0, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  async assign(conversationId: string, agentId: string | null): Promise<Conversation> {
    const [row] = await db
      .update(conversations)
      .set({ assignedAgentId: agentId, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .returning();
    return mapConversation(row!);
  }

  async setStatus(
    conversationId: string,
    status: ConversationStatus
  ): Promise<Conversation> {
    const [row] = await db
      .update(conversations)
      .set({ status, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .returning();
    return mapConversation(row!);
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

    const [{ total }] = await db
      .select({ total: count() })
      .from(conversations)
      .where(where);

    const offset = (input.page - 1) * input.pageSize;
    const rows = await db
      .select()
      .from(conversations)
      .where(where)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(input.pageSize)
      .offset(offset);

    const totalCount = Number(total ?? 0);
    return {
      items: rows.map(mapConversation),
      total: totalCount,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: totalCount === 0 ? 1 : Math.ceil(totalCount / input.pageSize),
    };
  }
}
