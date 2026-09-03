import { timingSafeEqual, createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { OpenWaGatewayAdapter } from "../../channels/openwa-gateway/openwa-gateway.adapter.js";
import type { ChannelRegistry } from "../../channels/channel-registry.js";

export interface OpenWaWebhookRouteDeps {
  adapter: OpenWaGatewayAdapter;
  secret: string;
  /** Si se pasa el registry, el webhook despacha al adaptador correcto por UUID de sesión. */
  registry?: ChannelRegistry;
}

interface WebhookEnvelope {
  event: string;
  sessionId: string;
  data: unknown;
}

function toBuffer(body: unknown): Buffer {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (body == null) return Buffer.alloc(0);
  // Fallback: algún proxy/parser ya lo convirtió en objeto.
  return Buffer.from(JSON.stringify(body), "utf8");
}

function verifySignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const expectedBuf = Buffer.from(expected);
  const headerBuf = Buffer.from(header);
  if (expectedBuf.length !== headerBuf.length) return false;
  return timingSafeEqual(expectedBuf, headerBuf);
}

/**
 * Recibe los webhooks del gateway OpenWA (docs §6.6).
 * Necesita el body crudo para validar X-OpenWA-Signature (HMAC-SHA256).
 */
export function registerOpenWaWebhookRoutes(app: FastifyInstance, deps: OpenWaWebhookRouteDeps): void {
  app.register(async (instance) => {
    // Acepta application/json con o sin charset (OpenWA / fetch a veces manda charset=utf-8).
    instance.removeContentTypeParser("application/json");
    instance.addContentTypeParser(
      /^application\/json(;.*)?$/i,
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body)
    );

    instance.post("/webhooks/openwa", async (request, reply) => {
      try {
        const raw = toBuffer(request.body);
        const signature = request.headers["x-openwa-signature"] as string | undefined;

        if (!verifySignature(raw, signature, deps.secret)) {
          return reply.code(401).send({ error: "Firma inválida" });
        }

        let envelope: WebhookEnvelope;
        try {
          envelope = JSON.parse(raw.toString("utf8")) as WebhookEnvelope;
        } catch {
          return reply.code(400).send({ error: "JSON inválido" });
        }

        // OpenWA envía sessionId = UUID. Preferimos match por gatewaySessionId.
        let target: OpenWaGatewayAdapter = deps.adapter;
        if (deps.registry) {
          const match = deps.registry.all().find((a) => {
            const gw = a as OpenWaGatewayAdapter;
            return typeof gw.gatewaySessionId === "string" && gw.gatewaySessionId === envelope.sessionId;
          }) as OpenWaGatewayAdapter | undefined;
          if (match) target = match;
        }

        target.handleWebhookEvent(envelope.event, envelope.sessionId, envelope.data);
        return reply.code(200).send({ received: true });
      } catch (err) {
        request.log.error({ err }, "Error procesando webhook OpenWA");
        // Respondemos 200 para no saturar reintentos de OpenWA ante bugs internos;
        // el polling de sesión sigue siendo la red de seguridad.
        return reply.code(200).send({ received: true, warning: "processed_with_error" });
      }
    });
  });
}
