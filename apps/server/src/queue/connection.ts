import IORedis, { type Redis } from "ioredis";
import { env } from "../config/env.js";

/** BullMQ requiere maxRetriesPerRequest: null en la conexión. */
export function createRedis(): Redis {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export const CAMPAIGN_QUEUE = "campaign-send";

/** Canal pub/sub para alterar el rate limit en caliente. */
export const RATE_LIMIT_CONTROL_CHANNEL = "rate-limit:update";
