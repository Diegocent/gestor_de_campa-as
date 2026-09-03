import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { RealtimePublisher } from "@gestor/core";
import { ChannelRegistry } from "../../channels/channel-registry.js";
import { OpenWaGatewayAdapter } from "../../channels/openwa-gateway/openwa-gateway.adapter.js";
import { env } from "../../config/env.js";

export interface ChannelRouteDeps {
  registry: ChannelRegistry;
  realtime: RealtimePublisher;
  organizationId: string;
  ingestMessage: (msg: import("@gestor/core").IOmnichannelMessage) => void;
  registerAck: (ack: import("@gestor/core").IOmnichannelAck) => void;
}

const createSessionBody = z.object({
  sessionName: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, "Solo letras, números, - y _"),
});

export function registerChannelRoutes(app: FastifyInstance, deps: ChannelRouteDeps): void {
  const auth = { preHandler: (req: any, reply: any) => app.authenticate(req, reply) };

  /** Lista todas las sesiones con su estado */
  app.get("/channels/sessions", auth, async (_request, reply) => {
    const sessions = deps.registry.all().map((adapter) => ({
      sessionName: adapter.sessionName,
      channelType: adapter.channelType,
      connected: adapter.isReady(),
      qr: adapter.getQr(),
    }));
    return reply.send(sessions);
  });

  /** Crea una nueva sesión */
  app.post("/channels/sessions", auth, async (request, reply) => {
    const body = createSessionBody.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Datos inválidos" });

    const { sessionName } = body.data;
    if (deps.registry.getBySession(sessionName)) {
      return reply.code(409).send({ error: "Ya existe una sesión con ese nombre" });
    }

    const adapter = new OpenWaGatewayAdapter({
      baseUrl: env.OPENWA_GATEWAY_URL,
      apiKey: env.OPENWA_GATEWAY_API_KEY,
      sessionName,
      webhookUrl: env.OPENWA_GATEWAY_WEBHOOK_URL,
      webhookSecret: env.OPENWA_GATEWAY_WEBHOOK_SECRET,
    });

    adapter.onMessage((msg) => deps.ingestMessage(msg));
    adapter.onAck((ack) => deps.registerAck(ack));
    adapter.onConnectionState((state) =>
      deps.realtime.emitChannelState(deps.organizationId, state, adapter.getQr())
    );

    deps.registry.register(adapter);
    adapter.start().catch((err) => {
      app.log.error({ err }, `[channels] Error al iniciar sesión ${sessionName}`);
    });

    return reply.code(201).send({
      sessionName,
      channelType: adapter.channelType,
      connected: false,
      qr: null,
    });
  });

  /** Elimina una sesión (local + gateway OpenWA) */
  app.delete("/channels/sessions/:sessionName", auth, async (request, reply) => {
    const { sessionName } = request.params as { sessionName: string };
    const adapter = deps.registry.getBySession(sessionName) as OpenWaGatewayAdapter | undefined;
    if (!adapter) return reply.code(404).send({ error: "Sesión no encontrada" });

    // Siempre sacamos del registry local. Si OpenWA falla, igual dejamos de
    // mostrar el canal; el usuario puede limpiar restos en el dashboard.
    try {
      if (typeof adapter.destroy === "function") {
        await adapter.destroy();
      } else {
        await adapter.stop().catch(() => undefined);
      }
    } catch (err) {
      app.log.warn({ err }, `[channels] OpenWA no eliminó ${sessionName}; se quita del registry igual`);
    }

    deps.registry.unregister(sessionName);
    return reply.send({ ok: true });
  });

  /** QR de una sesión específica */
  app.get("/channels/sessions/:sessionName/qr", auth, async (request, reply) => {
    const { sessionName } = request.params as { sessionName: string };
    const adapter = deps.registry.getBySession(sessionName);
    if (!adapter) return reply.code(404).send({ error: "Sesión no encontrada" });

    return reply.send({ qr: adapter.getQr(), connected: adapter.isReady() });
  });

  /** Reinicia la sesión para generar un QR fresco */
  app.post("/channels/sessions/:sessionName/restart", auth, async (request, reply) => {
    const { sessionName } = request.params as { sessionName: string };
    const adapter = deps.registry.getBySession(sessionName) as OpenWaGatewayAdapter | undefined;
    if (!adapter || typeof adapter.restartForQr !== "function") {
      return reply.code(404).send({ error: "Sesión no encontrada" });
    }
    try {
      await adapter.restartForQr();
      return reply.send({ ok: true, sessionName, connected: adapter.isReady(), qr: adapter.getQr() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo reiniciar";
      return reply.code(400).send({ error: message });
    }
  });

  /** Código de vinculación por número (alternativa al QR, docs OpenWA) */
  app.post("/channels/sessions/:sessionName/pairing-code", auth, async (request, reply) => {
    const { sessionName } = request.params as { sessionName: string };
    const body = z.object({ phoneNumber: z.string().min(8).max(20) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Número inválido" });

    const adapter = deps.registry.getBySession(sessionName) as OpenWaGatewayAdapter | undefined;
    if (!adapter || typeof adapter.requestPairingCode !== "function") {
      return reply.code(404).send({ error: "Sesión no encontrada" });
    }
    try {
      const pairingCode = await adapter.requestPairingCode(body.data.phoneNumber);
      return reply.send({ pairingCode });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo generar el código";
      return reply.code(400).send({ error: message });
    }
  });
}
