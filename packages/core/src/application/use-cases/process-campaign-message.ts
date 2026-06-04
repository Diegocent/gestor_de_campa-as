import type { IChannelRegistry } from "../../domain/channels/adapter.js";
import { toWhatsAppId } from "../../domain/phone.js";
import type { CampaignRepository } from "../ports.js";

/**
 * Procesa el envío de UN mensaje de campaña (ejecutado por el worker BullMQ bajo
 * el limitador de tasa dinámico). Idempotente respecto a cancelaciones.
 */
export class ProcessCampaignMessageUseCase {
  constructor(
    private readonly channels: IChannelRegistry,
    private readonly campaigns: CampaignRepository
  ) {}

  async execute(campaignMessageId: string): Promise<void> {
    const message = await this.campaigns.getMessageForSend(campaignMessageId);
    if (!message || message.status === "cancelled" || message.status === "sent") {
      return;
    }

    try {
      const adapter = this.channels.getDefault();
      const { providerMessageId } = await adapter.sendMessage({
        conversationRef: toWhatsAppId(message.phone),
        type: "text",
        text: message.messageBody,
      });
      await this.campaigns.markMessageSent(campaignMessageId, providerMessageId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Error de envío";
      await this.campaigns.markMessageFailed(campaignMessageId, reason);
    }
  }
}
