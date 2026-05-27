import { z } from "zod";
import { SEND_RATE_LIMITS } from "@/domain/send-rate";

export const updateSendRateSchema = z.object({
  maxMessages: z
    .number()
    .int()
    .min(SEND_RATE_LIMITS.maxMessages.min)
    .max(SEND_RATE_LIMITS.maxMessages.max),
  durationMinutes: z
    .number()
    .int()
    .min(SEND_RATE_LIMITS.durationMinutes.min)
    .max(SEND_RATE_LIMITS.durationMinutes.max),
});

export type UpdateSendRateRequest = z.infer<typeof updateSendRateSchema>;
