export type CampaignStatus =
  | "scheduled"
  | "processing"
  | "completed"
  | "partially_failed"
  | "cancelled";

export type CampaignMessageStatus =
  | "pending"
  | "queued"
  | "sent"
  | "failed"
  | "cancelled";

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

export interface CampaignMessage {
  id: string;
  campaignId: string;
  phone: string;
  recipientName: string | null;
  messageBody: string;
  status: CampaignMessageStatus;
  providerMessageId: string | null;
  lastError: string | null;
}

/** Fila cruda de un destinatario importado desde Excel/CSV. */
export interface RecipientRow {
  phone: string;
  name: string | null;
}
