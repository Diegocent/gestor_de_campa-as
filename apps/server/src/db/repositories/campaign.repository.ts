import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  Campaign,
  CampaignMessage,
  CampaignRepository,
  NewCampaignMessage,
  Paginated,
} from "@gestor/core";
import { db } from "../client.js";
import { campaignMessages, campaigns } from "../schema.js";
import { mapCampaign, mapCampaignMessage } from "../mappers.js";
import type { CampaignRow } from "../schema.js";

function resolveStatus(row: CampaignRow): CampaignRow["status"] {
  const done = row.sentCount + row.failedCount;
  if (row.status === "cancelled") return "cancelled";
  if (row.totalRecipients > 0 && done >= row.totalRecipients) {
    return row.failedCount === 0 ? "completed" : "partially_failed";
  }
  return "processing";
}

export class DrizzleCampaignRepository implements CampaignRepository {
  async createCampaign(input: {
    organizationId: string;
    title: string;
    messageBody: string;
    scheduledAt: Date;
  }): Promise<Campaign> {
    const [row] = await db.insert(campaigns).values(input).returning();
    return mapCampaign(row!);
  }

  async insertMessagesBatch(
    campaignId: string,
    messages: NewCampaignMessage[]
  ): Promise<string[]> {
    if (messages.length === 0) return [];
    const rows = await db
      .insert(campaignMessages)
      .values(messages.map((m) => ({ campaignId, ...m })))
      .returning({ id: campaignMessages.id });
    return rows.map((r) => r.id);
  }

  async finalizeTotals(campaignId: string, total: number): Promise<void> {
    await db
      .update(campaigns)
      .set({ totalRecipients: total, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
  }

  async getCampaign(organizationId: string, id: string): Promise<Campaign | null> {
    const [row] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, organizationId)))
      .limit(1);
    return row ? mapCampaign(row) : null;
  }

  async listCampaigns(input: {
    organizationId: string;
    page: number;
    pageSize: number;
  }): Promise<Paginated<Campaign>> {
    const where = eq(campaigns.organizationId, input.organizationId);
    const totals = await db
      .select({ total: count() })
      .from(campaigns)
      .where(where);
    const totalCount = Number(totals[0]?.total ?? 0);
    const offset = (input.page - 1) * input.pageSize;
    const rows = await db
      .select()
      .from(campaigns)
      .where(where)
      .orderBy(desc(campaigns.createdAt))
      .limit(input.pageSize)
      .offset(offset);
    return {
      items: rows.map(mapCampaign),
      total: totalCount,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: totalCount === 0 ? 1 : Math.ceil(totalCount / input.pageSize),
    };
  }

  async getMessageForSend(messageId: string): Promise<CampaignMessage | null> {
    const [row] = await db
      .select()
      .from(campaignMessages)
      .where(eq(campaignMessages.id, messageId))
      .limit(1);
    return row ? mapCampaignMessage(row) : null;
  }

  async markMessageSent(messageId: string, providerMessageId: string): Promise<void> {
    const [msg] = await db
      .update(campaignMessages)
      .set({ status: "sent", providerMessageId })
      .where(eq(campaignMessages.id, messageId))
      .returning({ campaignId: campaignMessages.campaignId });
    if (msg) await this.bumpCounters(msg.campaignId, "sent");
  }

  async markMessageFailed(messageId: string, error: string): Promise<void> {
    const [msg] = await db
      .update(campaignMessages)
      .set({ status: "failed", lastError: error.slice(0, 500) })
      .where(eq(campaignMessages.id, messageId))
      .returning({ campaignId: campaignMessages.campaignId });
    if (msg) await this.bumpCounters(msg.campaignId, "failed");
  }

  private async bumpCounters(campaignId: string, kind: "sent" | "failed"): Promise<void> {
    const [row] = await db
      .update(campaigns)
      .set(
        kind === "sent"
          ? { sentCount: sql`${campaigns.sentCount} + 1`, updatedAt: new Date() }
          : { failedCount: sql`${campaigns.failedCount} + 1`, updatedAt: new Date() }
      )
      .where(eq(campaigns.id, campaignId))
      .returning();
    if (row) {
      const status = resolveStatus(row);
      if (status !== row.status) {
        await db.update(campaigns).set({ status }).where(eq(campaigns.id, campaignId));
      }
    }
  }

  async cancelCampaign(organizationId: string, id: string): Promise<string[]> {
    const owned = await this.getCampaign(organizationId, id);
    if (!owned) return [];
    const pending = await db
      .update(campaignMessages)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(campaignMessages.campaignId, id),
          inArray(campaignMessages.status, ["pending", "queued"])
        )
      )
      .returning({ id: campaignMessages.id });
    await db
      .update(campaigns)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(campaigns.id, id));
    return pending.map((p) => p.id);
  }
}
