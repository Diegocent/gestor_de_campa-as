import { normalizePhoneNumber } from "@/domain/phone";
import type { CampaignRecipient } from "@/domain/types";
import {
  buildPersonalizedMessages,
  dedupeRecipients,
  type PersonalizedMessage,
} from "@/domain/message-template";

export function normalizeRecipients(recipients: CampaignRecipient[]): CampaignRecipient[] {
  const normalized: CampaignRecipient[] = [];

  for (const recipient of recipients) {
    const phoneNumber = normalizePhoneNumber(recipient.phoneNumber);
    if (!phoneNumber) continue;

    normalized.push({
      phoneNumber,
      recipientName: recipient.recipientName?.trim() || undefined,
    });
  }

  return dedupeRecipients(normalized);
}

export function prepareCampaignMessages(
  template: string,
  recipients: CampaignRecipient[]
): PersonalizedMessage[] {
  const uniqueRecipients = normalizeRecipients(recipients);

  if (uniqueRecipients.length === 0) {
    throw new Error("Debe ingresar al menos un número de teléfono válido");
  }

  return buildPersonalizedMessages(template, uniqueRecipients);
}
