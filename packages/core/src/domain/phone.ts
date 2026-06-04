const WHATSAPP_COUNTRY_PREFIX = "595";

/** Normaliza un teléfono a dígitos E.164 sin "+". Devuelve null si es inválido. */
export function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;

  if (digits.startsWith(WHATSAPP_COUNTRY_PREFIX)) return digits;
  if (digits.startsWith("0")) return `${WHATSAPP_COUNTRY_PREFIX}${digits.slice(1)}`;
  return `${WHATSAPP_COUNTRY_PREFIX}${digits}`;
}

/** "595981123456" -> "595981123456@c.us" */
export function toWhatsAppId(phoneNumber: string): string {
  return `${phoneNumber.replace(/\D/g, "")}@c.us`;
}

/** "595981123456@c.us" -> "595981123456" */
export function fromWhatsAppId(chatId: string): string {
  return chatId.split("@")[0]?.replace(/\D/g, "") ?? "";
}
