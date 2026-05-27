import { Queue, Worker, type JobsOptions } from "bullmq";
import type { JobQueue, SendMessagePayload } from "@/domain/types";
import type { SendRateSettings } from "@/domain/send-rate";
import { toDurationMs } from "@/domain/send-rate";
import { WHATSAPP_SEND_QUEUE, type WhatsAppJobData } from "./constants";

function getRedisConnectionOptions() {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return { url, maxRetriesPerRequest: null as null };
}

let queueInstance: Queue | null = null;

export function getWhatsAppQueue(): Queue<WhatsAppJobData> {
  if (!queueInstance) {
    queueInstance = new Queue(WHATSAPP_SEND_QUEUE, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 60_000,
        },
      },
    });
  }
  return queueInstance as Queue<WhatsAppJobData>;
}

export class BullMQJobQueue implements JobQueue {
  async enqueueDelayedSend(
    payload: SendMessagePayload,
    scheduledAt: Date
  ): Promise<string> {
    const delay = Math.max(0, scheduledAt.getTime() - Date.now());
    const job = await getWhatsAppQueue().add(
      "send-message",
      {
        messageId: payload.messageId,
        phoneNumber: payload.phoneNumber,
        messageBody: payload.messageBody,
      },
      { delay } satisfies JobsOptions
    );

    return job.id ?? "";
  }

  async removeJob(jobId: string): Promise<void> {
    if (!jobId) return;
    const job = await getWhatsAppQueue().getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}

export function createWhatsAppWorker(
  processor: (data: WhatsAppJobData) => Promise<void>,
  sendRate: SendRateSettings
): Worker {
  return new Worker(
    WHATSAPP_SEND_QUEUE,
    async (job) => {
      await processor(job.data as WhatsAppJobData);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 1,
      limiter: {
        max: sendRate.maxMessages,
        duration: toDurationMs(sendRate),
      },
    }
  );
}
