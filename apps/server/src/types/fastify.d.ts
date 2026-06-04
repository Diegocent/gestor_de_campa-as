import "fastify";
import type { AccessTokenClaims } from "@gestor/core";

declare module "fastify" {
  interface FastifyRequest {
    agent?: AccessTokenClaims;
  }
  interface FastifyInstance {
    authenticate: (
      request: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply
    ) => Promise<void>;
  }
}
