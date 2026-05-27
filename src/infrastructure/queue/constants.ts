export const WHATSAPP_SEND_QUEUE = "whatsapp-send";

export const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 10);
export const RATE_LIMIT_DURATION_MS = Number(process.env.RATE_LIMIT_DURATION_MS ?? 300_000);

export interface WhatsAppJobData {
  messageId: string;
  phoneNumber: string;
  messageBody: string;
}
