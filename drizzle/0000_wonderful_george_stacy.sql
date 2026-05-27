CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'processing', 'completed', 'partially_failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('pending', 'queued', 'processing', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"message_body" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "campaign_status" DEFAULT 'scheduled' NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"logo_url" text,
	"primary_color" varchar(7) DEFAULT '#2563eb' NOT NULL,
	"accent_color" varchar(7) DEFAULT '#0ea5e9' NOT NULL,
	"support_email" varchar(255),
	"footer_text" text,
	"message_templates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"recipient_name" varchar(255),
	"message_body" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "message_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"bull_job_id" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_org_idx" ON "campaigns" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "campaigns_scheduled_at_idx" ON "campaigns" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scheduled_messages_campaign_idx" ON "scheduled_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "scheduled_messages_status_scheduled_idx" ON "scheduled_messages" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "scheduled_messages_phone_idx" ON "scheduled_messages" USING btree ("phone_number");