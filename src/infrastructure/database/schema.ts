import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const messageStatusEnum = pgEnum("message_status", [
  "pending",
  "queued",
  "processing",
  "sent",
  "failed",
  "cancelled",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "processing",
  "completed",
  "partially_failed",
  "cancelled",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 7 }).notNull().default("#2563eb"),
  accentColor: varchar("accent_color", { length: 7 }).notNull().default("#0ea5e9"),
  supportEmail: varchar("support_email", { length: 255 }),
  footerText: text("footer_text"),
  messageTemplates: jsonb("message_templates")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  settings: jsonb("settings")
    .$type<{ sendRate: { maxMessages: number; durationMinutes: number } }>()
    .notNull()
    .default({ sendRate: { maxMessages: 10, durationMinutes: 5 } }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    messageBody: text("message_body").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: campaignStatusEnum("status").notNull().default("scheduled"),
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("campaigns_org_idx").on(table.organizationId),
    index("campaigns_scheduled_at_idx").on(table.scheduledAt),
    index("campaigns_status_idx").on(table.status),
  ]
);

export const scheduledMessages = pgTable(
  "scheduled_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }),
    messageBody: text("message_body").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: messageStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    bullJobId: varchar("bull_job_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scheduled_messages_campaign_idx").on(table.campaignId),
    index("scheduled_messages_status_scheduled_idx").on(table.status, table.scheduledAt),
    index("scheduled_messages_phone_idx").on(table.phoneNumber),
  ]
);

export type OrganizationRow = typeof organizations.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;
export type ScheduledMessageRow = typeof scheduledMessages.$inferSelect;
