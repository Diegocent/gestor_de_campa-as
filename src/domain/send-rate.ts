export interface SendRateSettings {
  maxMessages: number;
  durationMinutes: number;
}

export interface OrganizationSettings {
  sendRate: SendRateSettings;
}

export const SEND_RATE_LIMITS = {
  maxMessages: { min: 1, max: 30 },
  durationMinutes: { min: 1, max: 120 },
} as const;

function envMaxMessages(): number {
  const value = Number(process.env.RATE_LIMIT_MAX ?? 10);
  return Number.isFinite(value) && value > 0 ? value : 10;
}

function envDurationMinutes(): number {
  if (process.env.RATE_LIMIT_DURATION_MINUTES) {
    const value = Number(process.env.RATE_LIMIT_DURATION_MINUTES);
    return Number.isFinite(value) && value > 0 ? value : 5;
  }

  const ms = Number(process.env.RATE_LIMIT_DURATION_MS ?? 300_000);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60_000) : 5;
}

export const DEFAULT_SEND_RATE: SendRateSettings = {
  maxMessages: envMaxMessages(),
  durationMinutes: envDurationMinutes(),
};

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  sendRate: DEFAULT_SEND_RATE,
};

export function toDurationMs(settings: SendRateSettings): number {
  return settings.durationMinutes * 60_000;
}

export function formatSendRateLabel(settings: SendRateSettings): string {
  return `${settings.maxMessages} mensaje${settings.maxMessages === 1 ? "" : "s"} / ${settings.durationMinutes} min`;
}

export function resolveSendRateSettings(
  settings?: Partial<OrganizationSettings> | null
): SendRateSettings {
  return {
    maxMessages: settings?.sendRate?.maxMessages ?? DEFAULT_SEND_RATE.maxMessages,
    durationMinutes:
      settings?.sendRate?.durationMinutes ?? DEFAULT_SEND_RATE.durationMinutes,
  };
}

export function normalizeSendRateSettings(input: SendRateSettings): SendRateSettings {
  const maxMessages = Math.round(input.maxMessages);
  const durationMinutes = Math.round(input.durationMinutes);

  if (
    maxMessages < SEND_RATE_LIMITS.maxMessages.min ||
    maxMessages > SEND_RATE_LIMITS.maxMessages.max
  ) {
    throw new Error(
      `Máximo de mensajes debe estar entre ${SEND_RATE_LIMITS.maxMessages.min} y ${SEND_RATE_LIMITS.maxMessages.max}`
    );
  }

  if (
    durationMinutes < SEND_RATE_LIMITS.durationMinutes.min ||
    durationMinutes > SEND_RATE_LIMITS.durationMinutes.max
  ) {
    throw new Error(
      `El intervalo debe estar entre ${SEND_RATE_LIMITS.durationMinutes.min} y ${SEND_RATE_LIMITS.durationMinutes.max} minutos`
    );
  }

  return { maxMessages, durationMinutes };
}
