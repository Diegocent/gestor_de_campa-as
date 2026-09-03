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
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────
export const channelTypeEnum = pgEnum("channel_type", [
  "whatsapp_unofficial",
  "whatsapp_cloud",
]);

export const agentRoleEnum = pgEnum("agent_role", ["admin", "agent"]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "open",
  "pending",
  "resolved",
  "snoozed",
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "text",
  "image",
  "audio",
  "video",
  "document",
  "location",
  "system",
]);

export const storedMessageStatusEnum = pgEnum("stored_message_status", [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
]);

// ── Organización (single-tenant en F1, multi-tenant ready) ─────
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  settings: jsonb("settings")
    .$type<{ sendRate: { maxMessages: number; durationMinutes: number } }>()
    .notNull()
    .default({ sendRate: { maxMessages: 10, durationMinutes: 5 } }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Agentes (usuarios humanos, login JWT) ──────────────────────
export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: agentRoleEnum("role").notNull().default("agent"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agents_email_idx").on(t.email)]
);

// ── Contactos (clientes de WhatsApp) ───────────────────────────
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    channelType: channelTypeEnum("channel_type").notNull(),
    externalId: varchar("external_id", { length: 128 }).notNull(),
    phone: varchar("phone", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contacts_org_external_idx").on(t.organizationId, t.externalId),
    index("contacts_phone_idx").on(t.phone),
  ]
);

// ── Conversaciones (hilos) ─────────────────────────────────────
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channelType: channelTypeEnum("channel_type").notNull(),
    conversationRef: varchar("conversation_ref", { length: 128 }).notNull(),
    status: conversationStatusEnum("status").notNull().default("open"),
    assignedAgentId: uuid("assigned_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessagePreview: text("last_message_preview"),
    unreadCount: integer("unread_count").notNull().default(0),
    channelSessionId: varchar("channel_session_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("conversations_org_ref_idx").on(t.organizationId, t.conversationRef),
    // Índice clave para el ordenamiento dinámico del sidebar.
    index("conversations_org_last_msg_idx").on(t.organizationId, t.lastMessageAt),
    index("conversations_assigned_idx").on(t.assignedAgentId),
  ]
);

// ── Mensajes (inbound + outbound) ──────────────────────────────
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    providerMessageId: varchar("provider_message_id", { length: 191 }),
    direction: messageDirectionEnum("direction").notNull(),
    type: messageTypeEnum("type").notNull().default("text"),
    text: text("text"),
    mediaUrl: text("media_url"),
    mediaMimeType: varchar("media_mime_type", { length: 128 }),
    mediaFilename: varchar("media_filename", { length: 255 }),
    status: storedMessageStatusEnum("status").notNull().default("queued"),
    sentByAgentId: uuid("sent_by_agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.createdAt),
    uniqueIndex("messages_provider_idx").on(t.providerMessageId),
  ]
);

// ── Campañas masivas ───────────────────────────────────────────
export const campaignStatusEnum = pgEnum("campaign_status", [
  "scheduled",
  "processing",
  "completed",
  "partially_failed",
  "cancelled",
]);

export const campaignMessageStatusEnum = pgEnum("campaign_message_status", [
  "pending",
  "queued",
  "sent",
  "failed",
  "cancelled",
]);

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
  (t) => [index("campaigns_org_created_idx").on(t.organizationId, t.createdAt)]
);

export const campaignMessages = pgTable(
  "campaign_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 64 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }),
    messageBody: text("message_body").notNull(),
    status: campaignMessageStatusEnum("status").notNull().default("pending"),
    providerMessageId: varchar("provider_message_id", { length: 191 }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaign_messages_campaign_idx").on(t.campaignId, t.status)]
);

// ── Plantillas de mensajes ─────────────────────────────────────
export const messageTemplates = pgTable(
  "message_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("templates_org_idx").on(t.organizationId)]
);

export type OrganizationRow = typeof organizations.$inferSelect;
export type AgentRow = typeof agents.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;
export type CampaignMessageRow = typeof campaignMessages.$inferSelect;
export type MessageTemplateRow = typeof messageTemplates.$inferSelect;
