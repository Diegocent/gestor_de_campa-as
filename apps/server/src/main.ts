import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { eq } from "drizzle-orm";
import {
  IngestInboundMessageUseCase,
  RegisterAckUseCase,
  SendAgentMessageUseCase,
} from "@gestor/core";
import { env } from "./config/env.js";
import { buildStaticContainer } from "./container.js";
import { db } from "./db/client.js";
import { organizations } from "./db/schema.js";
import { DrizzleCampaignRepository } from "./db/repositories/campaign.repository.js";
import { registerAuth } from "./auth/auth-plugin.js";
import { registerAuthRoutes } from "./http/routes/auth.routes.js";
import { registerInboxRoutes } from "./http/routes/inbox.routes.js";
import { registerCampaignRoutes } from "./http/routes/campaign.routes.js";
import { registerSettingsRoutes } from "./http/routes/settings.routes.js";
import { SocketGateway } from "./realtime/socket-gateway.js";
import { ChannelRegistry } from "./channels/channel-registry.js";
import { OpenWaAdapter } from "./channels/openwa/openwa.adapter.js";
import { createRedis } from "./queue/connection.js";
import { BullCampaignQueue } from "./queue/campaign-queue.js";
import { CreateCampaignService } from "./campaigns/create-campaign.service.js";
import { startCampaignWorker } from "./campaigns/campaign-worker.js";

async function main() {
  const c = buildStaticContainer();
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(multipart);
  registerAuth(app, c.tokenService);

  const realtime = new SocketGateway(app.server, c.tokenService, env.CORS_ORIGIN);

  // Channel Adapter Pattern: registro de canales + adaptador OpenWA embebido.
  const channels = new ChannelRegistry();
  const openwa = new OpenWaAdapter({
    sessionId: env.OPENWA_SESSION_ID,
    multiDevice: env.OPENWA_MULTI_DEVICE,
    headless: env.OPENWA_HEADLESS,
  });
  channels.register(openwa);

  // Casos de uso del inbox.
  const ingest = new IngestInboundMessageUseCase(
    c.contactRepository,
    c.conversationRepository,
    c.messageRepository,
    realtime
  );
  const registerAck = new RegisterAckUseCase(c.messageRepository, realtime);
  const sendAgentMessage = new SendAgentMessageUseCase(
    c.conversationRepository,
    c.messageRepository,
    channels,
    realtime
  );

  // Organización por defecto (single-tenant en F1).
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, env.DEFAULT_ORG_SLUG))
    .limit(1);
  if (!org) {
    throw new Error(`Organización "${env.DEFAULT_ORG_SLUG}" no existe. Corré db:seed.`);
  }
  const organizationId = org.id;

  // Infraestructura de campañas + worker co-localizado (mismo proceso que OpenWA).
  const redis = createRedis();
  const campaignRepo = new DrizzleCampaignRepository();
  const campaignQueue = new BullCampaignQueue(redis);
  const createCampaign = new CreateCampaignService(campaignRepo, campaignQueue);
  const worker = startCampaignWorker({
    channels,
    campaigns: campaignRepo,
    connection: createRedis(),
    initial: {
      max: org.settings.sendRate.maxMessages,
      durationMs: org.settings.sendRate.durationMinutes * 60_000,
    },
  });

  // Rutas HTTP.
  app.get("/health", async () => ({ status: "ok" }));
  app.get(
    "/channel/qr",
    { preHandler: (req, reply) => app.authenticate(req, reply) },
    async () => ({ qr: openwa.getQr(), connected: openwa.isReady() })
  );
  registerAuthRoutes(app, c);
  registerInboxRoutes(app, {
    conversations: c.conversationRepository,
    messages: c.messageRepository,
    agents: c.agentRepository,
    sendAgentMessage,
    realtime,
  });
  registerCampaignRoutes(app, {
    createCampaign,
    campaigns: campaignRepo,
    queue: campaignQueue,
  });
  registerSettingsRoutes(app, { publisher: redis });

  // Wiring del Channel Adapter → casos de uso (contrato omnichannel).
  openwa.onMessage((message) => ingest.execute(organizationId, message));
  openwa.onAck((ack) => registerAck.execute(organizationId, ack));
  openwa.onConnectionState((state) =>
    realtime.emitChannelState(organizationId, state, openwa.getQr())
  );

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Servidor en http://localhost:${env.PORT}`);

  openwa.start().catch((err) => app.log.error({ err }, "OpenWA no pudo iniciar"));

  const shutdown = async () => {
    app.log.info("Cerrando...");
    await worker.stop().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    await openwa.stop().catch(() => undefined);
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Error fatal al iniciar el servidor:", error);
  process.exit(1);
});
