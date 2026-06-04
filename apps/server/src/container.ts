import { LoginUseCase, RefreshTokenUseCase } from "@gestor/core";
import { env } from "./config/env.js";
import { BcryptPasswordHasher } from "./auth/bcrypt-hasher.js";
import { JwtTokenService } from "./auth/jwt-token-service.js";
import { DrizzleAgentRepository } from "./db/repositories/agent.repository.js";
import { DrizzleContactRepository } from "./db/repositories/contact.repository.js";
import { DrizzleConversationRepository } from "./db/repositories/conversation.repository.js";
import { DrizzleInboxMessageRepository } from "./db/repositories/message.repository.js";

/**
 * Dependencias estáticas (sin tiempo real ni canales en vivo).
 * Las piezas que dependen de runtime (RealtimePublisher, IChannelRegistry)
 * se ensamblan en main.ts una vez levantados socket.io y los adaptadores.
 */
export function buildStaticContainer() {
  const tokenService = new JwtTokenService({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
  });
  const passwordHasher = new BcryptPasswordHasher();

  const agentRepository = new DrizzleAgentRepository();
  const contactRepository = new DrizzleContactRepository();
  const conversationRepository = new DrizzleConversationRepository();
  const messageRepository = new DrizzleInboxMessageRepository();

  const loginUseCase = new LoginUseCase(agentRepository, passwordHasher, tokenService);
  const refreshUseCase = new RefreshTokenUseCase(agentRepository, tokenService);

  return {
    tokenService,
    passwordHasher,
    agentRepository,
    contactRepository,
    conversationRepository,
    messageRepository,
    loginUseCase,
    refreshUseCase,
  };
}

export type StaticContainer = ReturnType<typeof buildStaticContainer>;
