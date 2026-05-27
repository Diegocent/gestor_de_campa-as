import { eq, and, lte, desc, count } from "drizzle-orm";
import type {
  Campaign,
  MessageRepository,
  MessageStatus,
  Organization,
  OrganizationRepository,
  OrganizationSettings,
  ScheduleCampaignInput,
  ScheduleCampaignResult,
  ScheduledMessage,
  UpdateCampaignInput,
} from "@/domain/types";
import type { CampaignPageResult } from "@/domain/campaign-pagination";
import { buildCampaignPageResult, normalizeCampaignPage } from "@/domain/campaign-pagination";
import { DEFAULT_ORGANIZATION_SETTINGS, resolveSendRateSettings } from "@/domain/send-rate";
import { getDb } from "./client";
import { campaigns, organizations, scheduledMessages } from "./schema";
import { inArray } from "drizzle-orm";

function mapOrganization(row: typeof organizations.$inferSelect): Organization {
  return {
    id: row.id,
    slug: row.slug,
    branding: {
      name: row.name,
      logoUrl: row.logoUrl ?? undefined,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      supportEmail: row.supportEmail ?? undefined,
      footerText: row.footerText ?? undefined,
    },
    messageTemplates: row.messageTemplates,
    settings: {
      sendRate: resolveSendRateSettings(row.settings as OrganizationSettings | null),
    },
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapMessage(row: typeof scheduledMessages.$inferSelect): ScheduledMessage {
  return {
    id: row.id,
    campaignId: row.campaignId,
    phoneNumber: row.phoneNumber,
    recipientName: row.recipientName,
    messageBody: row.messageBody,
    scheduledAt: row.scheduledAt,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    sentAt: row.sentAt,
    bullJobId: row.bullJobId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleOrganizationRepository implements OrganizationRepository {
  async findBySlug(slug: string): Promise<Organization | null> {
    const db = getDb();
    const [row] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    return row ? mapOrganization(row) : null;
  }

  async getDefault(): Promise<Organization> {
    const slug = process.env.DEFAULT_ORG_SLUG ?? "default";
    const org = await this.findBySlug(slug);
    if (!org) {
      throw new Error(`Organización por defecto "${slug}" no encontrada. Ejecuta las migraciones.`);
    }
    return org;
  }

  async updateSettings(slug: string, settings: OrganizationSettings): Promise<Organization> {
    const db = getDb();
    const [row] = await db
      .update(organizations)
      .set({ settings, updatedAt: new Date() })
      .where(eq(organizations.slug, slug))
      .returning();

    if (!row) {
      throw new Error("Organización no encontrada");
    }

    return mapOrganization(row);
  }
}

export class DrizzleMessageRepository implements MessageRepository {
  async createCampaignWithMessages(
    input: ScheduleCampaignInput & {
      organizationId: string;
      messages: Array<{
        phoneNumber: string;
        recipientName?: string;
        messageBody: string;
      }>;
    }
  ): Promise<ScheduleCampaignResult> {
    const db = getDb();

    return db.transaction(async (tx) => {
      const [campaign] = await tx
        .insert(campaigns)
        .values({
          organizationId: input.organizationId,
          title: input.title,
          messageBody: input.messageBody,
          scheduledAt: input.scheduledAt,
          status: "scheduled",
          totalRecipients: input.messages.length,
        })
        .returning({ id: campaigns.id });

      if (input.messages.length > 0) {
        await tx.insert(scheduledMessages).values(
          input.messages.map((message) => ({
            campaignId: campaign.id,
            phoneNumber: message.phoneNumber,
            recipientName: message.recipientName,
            messageBody: message.messageBody,
            scheduledAt: input.scheduledAt,
            status: "pending" as const,
          }))
        );
      }

      return {
        campaignId: campaign.id,
        scheduledCount: input.messages.length,
        scheduledAt: input.scheduledAt,
      };
    });
  }

  async getMessageById(id: string): Promise<ScheduledMessage | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(scheduledMessages)
      .where(eq(scheduledMessages.id, id))
      .limit(1);
    return row ? mapMessage(row) : null;
  }

  async getMessagesByCampaign(campaignId: string): Promise<ScheduledMessage[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(scheduledMessages)
      .where(eq(scheduledMessages.campaignId, campaignId));
    return rows.map(mapMessage);
  }

  async getPendingMessagesDue(before: Date): Promise<ScheduledMessage[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(scheduledMessages)
      .where(
        and(
          eq(scheduledMessages.status, "pending"),
          lte(scheduledMessages.scheduledAt, before)
        )
      );
    return rows.map(mapMessage);
  }

  async updateMessageStatus(
    id: string,
    status: MessageStatus,
    extra?: Partial<Pick<ScheduledMessage, "lastError" | "sentAt" | "bullJobId" | "attempts">>
  ): Promise<void> {
    const db = getDb();
    await db
      .update(scheduledMessages)
      .set({
        status,
        updatedAt: new Date(),
        ...extra,
      })
      .where(eq(scheduledMessages.id, id));
  }

  async incrementCampaignCounters(
    campaignId: string,
    delta: { sent?: number; failed?: number }
  ): Promise<void> {
    const db = getDb();
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) return;

    await db
      .update(campaigns)
      .set({
        sentCount: campaign.sentCount + (delta.sent ?? 0),
        failedCount: campaign.failedCount + (delta.failed ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
  }

  async refreshCampaignStatus(campaignId: string): Promise<void> {
    const db = getDb();
    const messages = await this.getMessagesByCampaign(campaignId);

    const pending = messages.filter((m) =>
      ["pending", "queued", "processing"].includes(m.status)
    ).length;
    const failed = messages.filter((m) => m.status === "failed").length;
    const sent = messages.filter((m) => m.status === "sent").length;

    let status: Campaign["status"] = "scheduled";

    if (pending > 0 && (sent > 0 || failed > 0)) {
      status = "processing";
    } else if (pending === 0 && sent > 0 && failed === 0) {
      status = "completed";
    } else if (pending === 0 && failed > 0 && sent === 0) {
      status = "partially_failed";
    } else if (pending === 0 && sent > 0 && failed > 0) {
      status = "partially_failed";
    }

    await db
      .update(campaigns)
      .set({ status, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
  }

  async getCampaignById(campaignId: string): Promise<Campaign | null> {
    const db = getDb();
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!row) return null;
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

  async listCampaignsPage(
    organizationId: string,
    page = 1,
    pageSize = 10
  ): Promise<CampaignPageResult> {
    const db = getDb();
    const { page: safePage, pageSize: safePageSize, offset } = normalizeCampaignPage(page, pageSize);

    const [{ total }] = await db
      .select({ total: count() })
      .from(campaigns)
      .where(eq(campaigns.organizationId, organizationId));

    const rows = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.organizationId, organizationId))
      .orderBy(desc(campaigns.scheduledAt))
      .limit(safePageSize)
      .offset(offset);

    const mapped = rows.map((row) => ({
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
    }));

    return buildCampaignPageResult(mapped, Number(total), safePage, safePageSize);
  }

  async listRecentCampaigns(organizationId: string, limit = 20): Promise<Campaign[]> {
    const page = await this.listCampaignsPage(organizationId, 1, limit);
    return page.campaigns;
  }

  async replaceScheduledCampaign(
    input: UpdateCampaignInput & {
      messages: Array<{
        phoneNumber: string;
        recipientName?: string;
        messageBody: string;
      }>;
    }
  ): Promise<ScheduleCampaignResult> {
    const db = getDb();

    return db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(scheduledMessages)
        .where(eq(scheduledMessages.campaignId, input.campaignId));

      const sentPhones = new Set(
        existingRows.filter((row) => row.status === "sent").map((row) => row.phoneNumber)
      );
      const sentCount = sentPhones.size;

      await tx
        .delete(scheduledMessages)
        .where(
          and(
            eq(scheduledMessages.campaignId, input.campaignId),
            inArray(scheduledMessages.status, ["pending", "queued", "processing", "failed"])
          )
        );

      const messagesToInsert = input.messages.filter(
        (message) => !sentPhones.has(message.phoneNumber)
      );

      await tx
        .update(campaigns)
        .set({
          title: input.title,
          messageBody: input.messageBody,
          scheduledAt: input.scheduledAt,
          totalRecipients: sentCount + messagesToInsert.length,
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, input.campaignId));

      if (messagesToInsert.length > 0) {
        await tx.insert(scheduledMessages).values(
          messagesToInsert.map((message) => ({
            campaignId: input.campaignId,
            phoneNumber: message.phoneNumber,
            recipientName: message.recipientName,
            messageBody: message.messageBody,
            scheduledAt: input.scheduledAt,
            status: "pending" as const,
          }))
        );
      }

      return {
        campaignId: input.campaignId,
        scheduledCount: messagesToInsert.length,
        scheduledAt: input.scheduledAt,
      };
    });
  }

  async cancelCampaign(campaignId: string): Promise<void> {
    const db = getDb();

    await db.transaction(async (tx) => {
      await tx
        .update(scheduledMessages)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(scheduledMessages.campaignId, campaignId),
            inArray(scheduledMessages.status, ["pending", "queued", "processing", "failed"])
          )
        );

      await tx
        .update(campaigns)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));
    });
  }
}

export async function seedDefaultOrganization() {
  const db = getDb();
  const slug = process.env.DEFAULT_ORG_SLUG ?? "default";

  await db
    .insert(organizations)
    .values({
      slug,
      name: "Mi Empresa",
      primaryColor: "#2563eb",
      accentColor: "#0ea5e9",
      footerText: "Mensaje automático de cobranzas.",
      messageTemplates: {
        reminder: "Estimado cliente, le recordamos su pago pendiente.",
        final_notice: "Último aviso antes de acciones de cobro.",
      },
      settings: DEFAULT_ORGANIZATION_SETTINGS,
    })
    .onConflictDoNothing({ target: organizations.slug });
}
