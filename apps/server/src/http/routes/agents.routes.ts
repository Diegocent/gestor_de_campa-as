import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AgentRepository, PasswordHasher } from "@gestor/core";

export interface AgentRouteDeps {
  agents: AgentRepository;
  passwordHasher: PasswordHasher;
}

const createBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(6),
  role: z.enum(["admin", "agent"]).default("agent"),
});

const updateBody = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.enum(["admin", "agent"]).optional(),
  isActive: z.boolean().optional(),
});

const passwordBody = z.object({
  password: z.string().min(6),
});

export function registerAgentRoutes(app: FastifyInstance, deps: AgentRouteDeps): void {
  const auth = { preHandler: (req: any, reply: any) => app.authenticate(req, reply) };

  const adminAuth = {
    preHandler: async (req: any, reply: any) => {
      await app.authenticate(req, reply);
      if (req.agent?.role !== "admin") {
        return reply.code(403).send({ error: "Acceso denegado: solo admins" });
      }
    },
  };

  /** POST /agents — crear agente (solo admin) */
  app.post("/agents", adminAuth, async (request, reply) => {
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });

    const existing = await deps.agents.findByEmail(parsed.data.email);
    if (existing) return reply.code(409).send({ error: "Ya existe un agente con ese email" });

    const passwordHash = await deps.passwordHasher.hash(parsed.data.password);
    const agent = await deps.agents.create({
      organizationId: request.agent!.organizationId,
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
    });
    return reply.code(201).send(agent);
  });

  /** PATCH /agents/:id — editar agente (solo admin) */
  app.patch("/agents/:id", adminAuth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Datos inválidos" });

    const existing = await deps.agents.findById(id);
    if (!existing || existing.organizationId !== request.agent!.organizationId) {
      return reply.code(404).send({ error: "Agente no encontrado" });
    }

    const updated = await deps.agents.update(id, parsed.data);
    return reply.send(updated);
  });

  /** PUT /agents/:id/password — cambiar contraseña (admin o el mismo agente) */
  app.put("/agents/:id/password", auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const isSelf = request.agent!.sub === id;
    const isAdmin = request.agent!.role === "admin";
    if (!isSelf && !isAdmin) {
      return reply.code(403).send({ error: "Acceso denegado" });
    }

    const parsed = passwordBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Contraseña inválida" });

    const existing = await deps.agents.findById(id);
    if (!existing || existing.organizationId !== request.agent!.organizationId) {
      return reply.code(404).send({ error: "Agente no encontrado" });
    }

    const passwordHash = await deps.passwordHasher.hash(parsed.data.password);
    await deps.agents.update(id, { passwordHash });
    return reply.send({ ok: true });
  });
}
