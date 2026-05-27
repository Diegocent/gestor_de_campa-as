import { z } from "zod";

export const campaignRecipientSchema = z.object({
  phoneNumber: z.string().min(8, "Teléfono inválido"),
  recipientName: z.string().max(255).optional(),
});

export const scheduleCampaignSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(255),
  messageBody: z.string().min(1, "El mensaje es obligatorio").max(4096),
  recipients: z.array(campaignRecipientSchema).min(1, "Ingrese al menos un destinatario"),
  scheduledAt: z.string().datetime({ message: "Fecha/hora inválida" }),
  organizationSlug: z.string().optional(),
});

export type ScheduleCampaignRequest = z.infer<typeof scheduleCampaignSchema>;
