import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { TokenService } from "@gestor/core";

/**
 * Decora la instancia raíz con `app.authenticate`, un preHandler que exige un
 * Bearer token válido y adjunta los claims en `request.agent`.
 */
export function registerAuth(app: FastifyInstance, tokenService: TokenService): void {
  app.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      const header = request.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        await reply.code(401).send({ error: "No autorizado" });
        return;
      }
      const token = header.slice("Bearer ".length).trim();
      try {
        request.agent = tokenService.verifyAccess(token);
      } catch {
        await reply.code(401).send({ error: "Token inválido o expirado" });
      }
    }
  );
}
