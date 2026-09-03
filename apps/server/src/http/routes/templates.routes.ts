import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { messageTemplates } from "../../db/schema.js";

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  body: z.string().min(1),
});

export function registerTemplateRoutes(app: FastifyInstance): void {
  const auth = { preHandler: (req: any, reply: any) => app.authenticate(req, reply) };

  app.get("/templates", auth, async (request, reply) => {
    const orgId = request.agent!.organizationId;
    const rows = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.organizationId, orgId))
      .orderBy(asc(messageTemplates.name));
    return reply.send(rows);
  });

  app.post("/templates", auth, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
    const orgId = request.agent!.organizationId;
    const [row] = await db
      .insert(messageTemplates)
      .values({ organizationId: orgId, name: parsed.data.name, body: parsed.data.body })
      .returning();
    return reply.code(201).send(row);
  });

  app.put("/templates/:id", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });
    const orgId = request.agent!.organizationId;
    const [row] = await db
      .update(messageTemplates)
      .set({ name: parsed.data.name, body: parsed.data.body, updatedAt: new Date() })
      .where(and(eq(messageTemplates.id, id), eq(messageTemplates.organizationId, orgId)))
      .returning();
    if (!row) return reply.code(404).send({ error: "Plantilla no encontrada" });
    return reply.send(row);
  });

  app.delete("/templates/:id", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const orgId = request.agent!.organizationId;
    await db
      .delete(messageTemplates)
      .where(and(eq(messageTemplates.id, id), eq(messageTemplates.organizationId, orgId)));
    return reply.code(204).send();
  });
}
