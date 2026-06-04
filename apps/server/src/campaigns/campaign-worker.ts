import type { Job } from "bullmq";
import type { Redis } from "ioredis";
import {
  ProcessCampaignMessageUseCase,
  type CampaignRepository,
  type IChannelRegistry,
} from "@gestor/core";
import {
  CAMPAIGN_QUEUE,
  RATE_LIMIT_CONTROL_CHANNEL,
  createRedis,
} from "../queue/connection.js";
import {
  DynamicRateLimitedWorker,
  type RateLimit,
} from "../queue/dynamic-worker-manager.js";

interface SendJob {
  campaignMessageId: string;
}

export interface CampaignWorkerHandle {
  stop(): Promise<void>;
}

/**
 * Arranca el worker de campañas (co-localizado con el adaptador OpenWA) bajo el
 * limitador de tasa dinámico. Escucha el canal de control para reciclar el
 * worker en caliente cuando cambia el límite, sin reiniciar el proceso.
 */
export function startCampaignWorker(deps: {
  channels: IChannelRegistry;
  campaigns: CampaignRepository;
  connection: Redis;
  initial: RateLimit;
}): CampaignWorkerHandle {
  const useCase = new ProcessCampaignMessageUseCase(deps.channels, deps.campaigns);
  const processor = async (job: Job<SendJob>) => {
    await useCase.execute(job.data.campaignMessageId);
  };

  const manager = new DynamicRateLimitedWorker<SendJob>(
    CAMPAIGN_QUEUE,
    deps.connection,
    processor,
    deps.initial
  );
  manager.start();

  const subscriber = createRedis();
  void subscriber.subscribe(RATE_LIMIT_CONTROL_CHANNEL);
  subscriber.on("message", (_channel, raw) => {
    try {
      const next = JSON.parse(raw) as RateLimit;
      if (typeof next.max === "number" && typeof next.durationMs === "number") {
        void manager.updateLimit(next);
      }
    } catch {
      /* mensaje de control inválido, ignorar */
    }
  });

  return {
    async stop() {
      await subscriber.quit().catch(() => undefined);
      await manager.stop();
    },
  };
}
