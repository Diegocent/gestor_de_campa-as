import { z } from "zod";
import { campaignRecipientSchema } from "@/application/validators/schedule-campaign";

export const updateCampaignSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(255),
  messageBody: z.string().min(1, "El mensaje es obligatorio").max(4096),
  recipients: z.array(campaignRecipientSchema).min(1, "Ingrese al menos un destinatario"),
  scheduledAt: z.string().datetime({ message: "Fecha/hora inválida" }),
});

export type UpdateCampaignRequest = z.infer<typeof updateCampaignSchema>;
