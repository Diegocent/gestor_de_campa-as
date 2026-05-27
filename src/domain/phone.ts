const WHATSAPP_COUNTRY_PREFIX = "595";

export function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;

  if (digits.startsWith(WHATSAPP_COUNTRY_PREFIX)) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `${WHATSAPP_COUNTRY_PREFIX}${digits.slice(1)}`;
  }

  return `${WHATSAPP_COUNTRY_PREFIX}${digits}`;
}

export function parsePhoneList(input: string): string[] {
  const lines = input
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const normalized = lines
    .map(normalizePhoneNumber)
    .filter((phone): phone is string => phone !== null);

  return [...new Set(normalized)];
}

export function formatWhatsAppId(phoneNumber: string): string {
  return `${phoneNumber.replace(/\D/g, "")}@c.us`;
}
