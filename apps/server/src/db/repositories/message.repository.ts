import { count, desc, eq } from "drizzle-orm";
import type {
  IOmnichannelMessage,
  InboxMessageRepository,
  Paginated,
  StoredMessage,
} from "@gestor/core";
import { db } from "../client.js";
import { messages } from "../schema.js";
import { mapMessage } from "../mappers.js";

export class DrizzleInboxMessageRepository implements InboxMessageRepository {
  async insertInbound(
    organizationId: string,
    conversationId: string,
    message: IOmnichannelMessage
  ): Promise<StoredMessage> {
    const [row] = await db
      .insert(messages)
      .values({
        organizationId,
        conversationId,
        providerMessageId: message.providerMessageId,
        direction: "inbound",
        type: message.type,
        text: message.text ?? null,
        mediaUrl: message.media?.url ?? null,
        mediaMimeType: message.media?.mimeType ?? null,
        mediaFilename: message.media?.filename ?? null,
        status: "delivered",
      })
      .returning();
    return mapMessage(row!);
  }

  async insertOutbound(input: {
    organizationId: string;
    conversationId: string;
    sentByAgentId: string | null;
    type: StoredMessage["type"];
    text: string | null;
    providerMessageId: string | null;
  }): Promise<StoredMessage> {
    const [row] = await db
      .insert(messages)
      .values({
        organizationId: input.organizationId,
        conversationId: input.conversationId,
        providerMessageId: input.providerMessageId,
        direction: "outbound",
        type: input.type,
        text: input.text,
        status: input.providerMessageId ? "sent" : "queued",
        sentByAgentId: input.sentByAgentId,
      })
      .returning();
    return mapMessage(row!);
  }

  async updateStatusByProviderId(
    providerMessageId: string,
    status: StoredMessage["status"]
  ): Promise<void> {
    await db
      .update(messages)
      .set({ status })
      .where(eq(messages.providerMessageId, providerMessageId));
  }

  async existsByProviderId(providerMessageId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.providerMessageId, providerMessageId))
      .limit(1);
    return Boolean(row);
  }

  async listByConversation(input: {
    conversationId: string;
    page: number;
    pageSize: number;
  }): Promise<Paginated<StoredMessage>> {
    const where = eq(messages.conversationId, input.conversationId);

    const [{ total }] = await db.select({ total: count() }).from(messages).where(where);

    const offset = (input.page - 1) * input.pageSize;
    const rows = await db
      .select()
      .from(messages)
      .where(where)
      .orderBy(desc(messages.createdAt))
      .limit(input.pageSize)
      .offset(offset);

    const totalCount = Number(total ?? 0);
    // Devolvemos en orden cronológico ascendente para el render del chat.
    return {
      items: rows.map(mapMessage).reverse(),
      total: totalCount,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: totalCount === 0 ? 1 : Math.ceil(totalCount / input.pageSize),
    };
  }
}
