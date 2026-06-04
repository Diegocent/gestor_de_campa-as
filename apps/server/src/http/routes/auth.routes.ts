import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { StaticContainer } from "../../container.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance, c: StaticContainer): void {
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Datos inválidos" });
    }
    try {
      const result = await c.loginUseCase.execute(parsed.data.email, parsed.data.password);
      return reply.send(result);
    } catch {
      return reply.code(401).send({ error: "Credenciales inválidas" });
    }
  });

  app.post("/auth/refresh", async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Datos inválidos" });
    }
    try {
      const tokens = await c.refreshUseCase.execute(parsed.data.refreshToken);
      return reply.send(tokens);
    } catch {
      return reply.code(401).send({ error: "Sesión inválida" });
    }
  });

  app.get(
    "/auth/me",
    { preHandler: (req, reply) => app.authenticate(req, reply) },
    async (request, reply) => {
      if (!request.agent) return reply.code(401).send({ error: "No autorizado" });
      const agent = await c.agentRepository.findById(request.agent.sub);
      if (!agent) return reply.code(404).send({ error: "Agente no encontrado" });
      return reply.send(agent);
    }
  );
}
