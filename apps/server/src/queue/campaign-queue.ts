import { Queue } from "bullmq";
import type { CampaignJobQueue } from "@gestor/core";
import { CAMPAIGN_QUEUE } from "./connection.js";

export class BullCampaignQueue implements CampaignJobQueue {
  private readonly queue: Queue;

  constructor(connection: any) {
    this.queue = new Queue(CAMPAIGN_QUEUE, { connection: connection as any });
  }

  async enqueueSend(input: { campaignMessageId: string; delayMs: number }): Promise<void> {
    await this.queue.add(
      "send",
      { campaignMessageId: input.campaignMessageId },
      {
        jobId: input.campaignMessageId,
        delay: input.delayMs > 0 ? input.delayMs : undefined,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: 500,
      }
    );
  }

  async removeJobs(campaignMessageIds: string[]): Promise<void> {
    await Promise.all(
      campaignMessageIds.map((id) => this.queue.remove(id).catch(() => undefined))
    );
  }
}
