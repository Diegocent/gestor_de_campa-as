import { Redis as IORedis } from "ioredis";
import { env } from "../config/env.js";

/** BullMQ requiere maxRetriesPerRequest: null en la conexión. */
export function createRedis(): any {
  // Nota: en entornos con múltiples resoluciones de `ioredis` (hoisting),
  // los tipos de TypeScript pueden no coincidir con los esperados por BullMQ.
  // En runtime funciona; por eso se usa un tipado laxo aquí para que `tsc`
  // compile en producción.
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }) as any;
}

export const CAMPAIGN_QUEUE = "campaign-send";

/** Canal pub/sub para alterar el rate limit en caliente. */
export const RATE_LIMIT_CONTROL_CHANNEL = "rate-limit:update";
