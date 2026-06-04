import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/client.js";
import { organizations } from "../../db/schema.js";
import { RATE_LIMIT_CONTROL_CHANNEL } from "../../queue/connection.js";

export interface SettingsRouteDeps {
  publisher: Redis;
}

const patchSchema = z.object({
  maxMessages: z.coerce.number().int().min(1).max(1000),
  durationMinutes: z.coerce.number().int().min(1).max(120),
});

export function registerSettingsRoutes(app: FastifyInstance, deps: SettingsRouteDeps): void {
  const auth = { preHandler: (req: any, reply: any) => app.authenticate(req, reply) };

  app.get("/settings/send-rate", auth, async (request, reply) => {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, request.agent!.organizationId))
      .limit(1);
    if (!org) return reply.code(404).send({ error: "Organización no encontrada" });
    return reply.send(org.settings.sendRate);
  });

  app.patch("/settings/send-rate", auth, async (request, reply) => {
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });

    const sendRate = {
      maxMessages: parsed.data.maxMessages,
      durationMinutes: parsed.data.durationMinutes,
    };
    await db
      .update(organizations)
      .set({ settings: { sendRate }, updatedAt: new Date() })
      .where(eq(organizations.id, request.agent!.organizationId));

    // Recicla el worker EN CALIENTE con el nuevo límite (sin reiniciar Node).
    await deps.publisher.publish(
      RATE_LIMIT_CONTROL_CHANNEL,
      JSON.stringify({ max: sendRate.maxMessages, durationMs: sendRate.durationMinutes * 60_000 })
    );

    return reply.send(sendRate);
  });
}
