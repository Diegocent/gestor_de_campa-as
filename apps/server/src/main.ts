import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { eq } from "drizzle-orm";
import {
  IngestInboundMessageUseCase,
  RegisterAckUseCase,
  SendAgentMessageUseCase,
  StartConversationUseCase,
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
import { registerOpenWaWebhookRoutes } from "./http/routes/openwa-webhook.routes.js";
import { registerChannelRoutes } from "./http/routes/channels.routes.js";
import { registerTemplateRoutes } from "./http/routes/templates.routes.js";
import { registerAgentRoutes } from "./http/routes/agents.routes.js";
import { SocketGateway } from "./realtime/socket-gateway.js";
import { ChannelRegistry } from "./channels/channel-registry.js";
import { OpenWaGatewayAdapter } from "./channels/openwa-gateway/openwa-gateway.adapter.js";
import { createRedis } from "./queue/connection.js";
import { BullCampaignQueue } from "./queue/campaign-queue.js";
import { CreateCampaignService } from "./campaigns/create-campaign.service.js";
import { startCampaignWorker } from "./campaigns/campaign-worker.js";

async function main() {
  const c = buildStaticContainer();
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(multipart, {
    limits: { fileSize: 16 * 1024 * 1024 },
  });
  registerAuth(app, c.tokenService);

  const realtime = new SocketGateway(app.server, c.tokenService, env.CORS_ORIGIN);

  // Channel Adapter Pattern: registro de canales + adaptador del gateway OpenWA
  // (servicio self-hosted aparte, ver docker-compose.yml). Le hablamos por REST
  // y recibimos sus eventos por webhook (registrado más abajo).
  const channels = new ChannelRegistry();
  const openwa = new OpenWaGatewayAdapter({
    baseUrl: env.OPENWA_GATEWAY_URL,
    apiKey: env.OPENWA_GATEWAY_API_KEY,
    sessionName: env.OPENWA_GATEWAY_SESSION_NAME,
    webhookUrl: env.OPENWA_GATEWAY_WEBHOOK_URL,
    webhookSecret: env.OPENWA_GATEWAY_WEBHOOK_SECRET,
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
  const startConversation = new StartConversationUseCase(
    c.contactRepository,
    c.conversationRepository,
    channels,
    sendAgentMessage
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

  // Infraestructura de campañas + worker co-localizado en este mismo proceso.
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
    startConversation,
    realtime,
  });
  registerCampaignRoutes(app, {
    createCampaign,
    campaigns: campaignRepo,
    queue: campaignQueue,
  });
  registerSettingsRoutes(app, { publisher: redis });
  registerOpenWaWebhookRoutes(app, { adapter: openwa, secret: env.OPENWA_GATEWAY_WEBHOOK_SECRET, registry: channels });
  registerChannelRoutes(app, {
    registry: channels,
    realtime,
    organizationId,
    ingestMessage: (msg) => ingest.execute(organizationId, msg),
    registerAck: (ack) => registerAck.execute(organizationId, ack),
  });
  registerTemplateRoutes(app);
  registerAgentRoutes(app, { agents: c.agentRepository, passwordHasher: c.passwordHasher });

  // Wiring del Channel Adapter → casos de uso (contrato omnichannel).
  openwa.onMessage((message) => {
    void ingest.execute(organizationId, message).catch((err) =>
      app.log.error({ err, providerMessageId: message.providerMessageId }, "Error al ingerir mensaje")
    );
  });
  openwa.onAck((ack) => {
    void registerAck.execute(organizationId, ack).catch((err) =>
      app.log.error({ err, providerMessageId: ack.providerMessageId }, "Error al registrar ACK")
    );
  });

  const agendaSyncing = new Set<string>();
  const syncAgendaNames = async (adapter: OpenWaGatewayAdapter) => {
    const key = adapter.sessionName;
    if (agendaSyncing.has(key) || !adapter.isReady()) return;
    agendaSyncing.add(key);
    try {
      const items = await adapter.fetchAgendaContacts();
      if (items.length === 0) return;
      await c.contactRepository.upsertAgendaNames(organizationId, items);
      app.log.info(`[contacts] Sincronizados ${items.length} nombres de agenda (${key})`);
    } catch (err) {
      app.log.warn({ err }, "[contacts] No se pudo sincronizar agenda de WhatsApp");
    } finally {
      agendaSyncing.delete(key);
    }
  };

  openwa.onConnectionState((state) => {
    realtime.emitChannelState(organizationId, state, openwa.getQr());
    if (state === "connected") {
      void syncAgendaNames(openwa);
    }
  });

  // Multi-sesión: al crear un canal nuevo también sincronizamos al conectar.
  const originalRegister = channels.register.bind(channels);
  channels.register = (adapter) => {
    originalRegister(adapter);
    if (adapter instanceof OpenWaGatewayAdapter) {
      adapter.onConnectionState((state) => {
        if (state === "connected") void syncAgendaNames(adapter);
      });
    }
  };

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
