import type {
  JobQueue,
  MessageRepository,
  UpdateCampaignInput,
} from "@/domain/types";
import { assertCampaignEditable, isActiveQueueMessage } from "@/domain/campaign-rules";
import { prepareCampaignMessages } from "@/domain/recipients";

export class UpdateCampaignUseCase {
  constructor(
    private readonly messages: MessageRepository,
    private readonly queue: JobQueue
  ) {}

  async execute(input: UpdateCampaignInput): Promise<{ campaignId: string; scheduledCount: number }> {
    const campaign = await this.messages.getCampaignById(input.campaignId);
    if (!campaign) {
      throw new Error("Campaña no encontrada");
    }

    const existingMessages = await this.messages.getMessagesByCampaign(input.campaignId);
    assertCampaignEditable(campaign, existingMessages);

    const personalizedMessages = prepareCampaignMessages(input.messageBody, input.recipients);

    if (input.scheduledAt.getTime() <= Date.now()) {
      throw new Error("La fecha programada debe ser futura");
    }

    for (const message of existingMessages) {
      if (message.bullJobId && isActiveQueueMessage(message)) {
        await this.queue.removeJob(message.bullJobId);
      }
    }

    const result = await this.messages.replaceScheduledCampaign({
      ...input,
      messages: personalizedMessages,
    });

    const newMessages = await this.messages.getMessagesByCampaign(input.campaignId);

    for (const message of newMessages) {
      if (message.status !== "pending") continue;

      const jobId = await this.queue.enqueueDelayedSend(
        {
          messageId: message.id,
          phoneNumber: message.phoneNumber,
          messageBody: message.messageBody,
        },
        message.scheduledAt
      );

      await this.messages.updateMessageStatus(message.id, "queued", {
        bullJobId: jobId,
      });
    }

    return {
      campaignId: result.campaignId,
      scheduledCount: result.scheduledCount,
    };
  }
}

export class DeleteCampaignUseCase {
  constructor(
    private readonly messages: MessageRepository,
    private readonly queue: JobQueue
  ) {}

  async execute(campaignId: string): Promise<void> {
    const campaign = await this.messages.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error("Campaña no encontrada");
    }

    const existingMessages = await this.messages.getMessagesByCampaign(campaignId);
    assertCampaignEditable(campaign, existingMessages);

    for (const message of existingMessages) {
      if (message.bullJobId && isActiveQueueMessage(message)) {
        await this.queue.removeJob(message.bullJobId);
      }
    }

    await this.messages.cancelCampaign(campaignId);
  }
}

