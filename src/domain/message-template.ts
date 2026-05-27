import type { CampaignRecipient } from "@/domain/types";

export interface PersonalizedMessage {
  phoneNumber: string;
  recipientName?: string;
  messageBody: string;
}

const PLACEHOLDER_PATTERN = /\{nombre\}|\{name\}/gi;

export function hasNamePlaceholder(template: string): boolean {
  return PLACEHOLDER_PATTERN.test(template);
}

export function personalizeMessage(
  template: string,
  recipient: Pick<CampaignRecipient, "recipientName">
): string {
  const name = recipient.recipientName?.trim() || "cliente";

  return template.replace(PLACEHOLDER_PATTERN, name);
}

export function buildPersonalizedMessages(
  template: string,
  recipients: CampaignRecipient[]
): PersonalizedMessage[] {
  return recipients.map((recipient) => ({
    phoneNumber: recipient.phoneNumber,
    recipientName: recipient.recipientName,
    messageBody: personalizeMessage(template, recipient),
  }));
}

export function dedupeRecipients(recipients: CampaignRecipient[]): CampaignRecipient[] {
  const map = new Map<string, CampaignRecipient>();

  for (const recipient of recipients) {
    map.set(recipient.phoneNumber, recipient);
  }

  return [...map.values()];
}
