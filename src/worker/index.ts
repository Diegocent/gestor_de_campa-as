import "dotenv/config";
import { ProcessSendMessageUseCase } from "@/application/use-cases/schedule-campaign";
import {
  DrizzleMessageRepository,
  DrizzleOrganizationRepository,
} from "@/infrastructure/database/repositories";
import { createWhatsAppWorker } from "@/infrastructure/queue/bullmq";
import { createWhatsAppSender } from "@/infrastructure/whatsapp/create-sender";
import { formatSendRateLabel, resolveSendRateSettings } from "@/domain/send-rate";

async function main() {
  console.log("[worker] Iniciando worker de WhatsApp...");

  const orgRepo = new DrizzleOrganizationRepository();
  const organization = await orgRepo.getDefault();
  const sendRate = resolveSendRateSettings(organization.settings);

  const sender = await createWhatsAppSender();
  const messageRepo = new DrizzleMessageRepository();
  const processMessage = new ProcessSendMessageUseCase(messageRepo, sender);

  const worker = createWhatsAppWorker(async (data) => {
    console.log(`[worker] Procesando mensaje ${data.messageId} → ${data.phoneNumber}`);
    await processMessage.execute(data);
    console.log(`[worker] Mensaje ${data.messageId} enviado correctamente`);
  }, sendRate);

  worker.on("failed", (job, error) => {
    console.error(`[worker] Job ${job?.id} falló:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("[worker] Error del worker:", error);
  });

  const shutdown = async () => {
    console.log("[worker] Cerrando worker...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`[worker] Worker activo. Rate limit: ${formatSendRateLabel(sendRate)}.`);
}

main().catch((error) => {
  console.error("[worker] Error fatal:", error);
  process.exit(1);
});
