import {
  personalizeMessage,
  type Campaign,
  type CampaignJobQueue,
  type CampaignRepository,
  type NewCampaignMessage,
  type RecipientRow,
} from "@gestor/core";

const BATCH_SIZE = 500;

export interface CreateCampaignInput {
  organizationId: string;
  title: string;
  messageBody: string;
  scheduledAt: Date;
  recipients: AsyncIterable<RecipientRow>;
}

/**
 * Crea una campaña consumiendo los destinatarios por STREAM: arma lotes,
 * los inserta en bloque (Bulk Create) y encola cada envío en BullMQ. El uso de
 * memoria queda acotado al tamaño del lote, sin importar el tamaño del archivo.
 */
export class CreateCampaignService {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly queue: CampaignJobQueue
  ) {}

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const campaign = await this.campaigns.createCampaign({
      organizationId: input.organizationId,
      title: input.title,
      messageBody: input.messageBody,
      scheduledAt: input.scheduledAt,
    });

    const delayMs = Math.max(0, input.scheduledAt.getTime() - Date.now());
    let total = 0;
    let batch: NewCampaignMessage[] = [];

    const flush = async () => {
      if (batch.length === 0) return;
      const ids = await this.campaigns.insertMessagesBatch(campaign.id, batch);
      await Promise.all(
        ids.map((campaignMessageId) =>
          this.queue.enqueueSend({ campaignMessageId, delayMs })
        )
      );
      batch = [];
    };

    for await (const recipient of input.recipients) {
      batch.push({
        phone: recipient.phone,
        recipientName: recipient.name,
        messageBody: personalizeMessage(input.messageBody, recipient.name),
      });
      total += 1;
      if (batch.length >= BATCH_SIZE) await flush();
    }
    await flush();

    await this.campaigns.finalizeTotals(campaign.id, total);
    return { ...campaign, totalRecipients: total };
  }
}
