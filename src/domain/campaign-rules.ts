import type { Campaign, ScheduledMessage } from "@/domain/types";

const FINAL_MESSAGE_STATUSES = new Set<ScheduledMessage["status"]>(["sent", "cancelled"]);

export function isCampaignEditable(
  campaign: Campaign,
  messages: ScheduledMessage[]
): boolean {
  if (campaign.status === "cancelled") return false;

  if (messages.length > 0) {
    return messages.some((message) => !FINAL_MESSAGE_STATUSES.has(message.status));
  }

  return campaign.sentCount < campaign.totalRecipients;
}

export function assertCampaignEditable(
  campaign: Campaign,
  messages: ScheduledMessage[]
): void {
  if (!isCampaignEditable(campaign, messages)) {
    throw new Error(
      "Solo se pueden modificar o eliminar campañas mientras queden destinatarios sin enviar"
    );
  }
}

export function isActiveQueueMessage(message: ScheduledMessage): boolean {
  return message.status !== "sent" && message.status !== "cancelled";
}
