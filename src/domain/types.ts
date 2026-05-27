import type { OrganizationSettings } from "@/domain/send-rate";

export type { OrganizationSettings };

export type MessageStatus =
  | "pending"
  | "queued"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "processing"
  | "completed"
  | "partially_failed"
  | "cancelled";

export interface OrganizationBranding {
  name: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  supportEmail?: string;
  footerText?: string;
}

export interface Organization {
  id: string;
  slug: string;
  branding: OrganizationBranding;
  messageTemplates: Record<string, string>;
  settings: OrganizationSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  id: string;
  organizationId: string;
  title: string;
  messageBody: string;
  scheduledAt: Date;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledMessage {
  id: string;
  campaignId: string;
  phoneNumber: string;
  recipientName?: string | null;
  messageBody: string;
  scheduledAt: Date;
  status: MessageStatus;
  attempts: number;
  lastError?: string | null;
  sentAt?: Date | null;
  bullJobId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignRecipient {
  phoneNumber: string;
  recipientName?: string;
}

export interface ScheduleCampaignInput {
  organizationSlug: string;
  title: string;
  messageBody: string;
  recipients: CampaignRecipient[];
  scheduledAt: Date;
}

export interface ScheduleCampaignResult {
  campaignId: string;
  scheduledCount: number;
  scheduledAt: Date;
}

export interface SendMessagePayload {
  messageId: string;
  phoneNumber: string;
  messageBody: string;
}

export interface WhatsAppSender {
  sendText(phoneNumber: string, message: string): Promise<void>;
  isReady(): boolean;
}

export interface MessageRepository {
  createCampaignWithMessages(
    input: ScheduleCampaignInput & {
      organizationId: string;
      messages: Array<{
        phoneNumber: string;
        recipientName?: string;
        messageBody: string;
      }>;
    }
  ): Promise<ScheduleCampaignResult>;
  getMessageById(id: string): Promise<ScheduledMessage | null>;
  getMessagesByCampaign(campaignId: string): Promise<ScheduledMessage[]>;
  getPendingMessagesDue(before: Date): Promise<ScheduledMessage[]>;
  updateMessageStatus(
    id: string,
    status: MessageStatus,
    extra?: Partial<Pick<ScheduledMessage, "lastError" | "sentAt" | "bullJobId" | "attempts">>
  ): Promise<void>;
  incrementCampaignCounters(
    campaignId: string,
    delta: { sent?: number; failed?: number }
  ): Promise<void>;
  refreshCampaignStatus(campaignId: string): Promise<void>;
  getCampaignById(campaignId: string): Promise<Campaign | null>;
  listCampaignsPage(
    organizationId: string,
    page?: number,
    pageSize?: number
  ): Promise<import("@/domain/campaign-pagination").CampaignPageResult>;
  listRecentCampaigns(organizationId: string, limit?: number): Promise<Campaign[]>;
  replaceScheduledCampaign(
    input: UpdateCampaignInput & {
      messages: Array<{
        phoneNumber: string;
        recipientName?: string;
        messageBody: string;
      }>;
    }
  ): Promise<ScheduleCampaignResult>;
  cancelCampaign(campaignId: string): Promise<void>;
}

export interface OrganizationRepository {
  findBySlug(slug: string): Promise<Organization | null>;
  getDefault(): Promise<Organization>;
  updateSettings(slug: string, settings: OrganizationSettings): Promise<Organization>;
}

export interface UpdateCampaignInput {
  campaignId: string;
  title: string;
  messageBody: string;
  recipients: CampaignRecipient[];
  scheduledAt: Date;
}

export interface JobQueue {
  enqueueDelayedSend(
    payload: SendMessagePayload,
    scheduledAt: Date
  ): Promise<string>;
  removeJob(jobId: string): Promise<void>;
}
