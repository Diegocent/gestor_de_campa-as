import type { Agent } from "../../domain/inbox/entities.js";
import type {
  AgentRepository,
  PasswordHasher,
  TokenPair,
  TokenService,
} from "../ports.js";

export interface AuthResult {
  agent: Agent;
  tokens: TokenPair;
}

function toPublicAgent(agent: Agent): Agent {
  return {
    id: agent.id,
    organizationId: agent.organizationId,
    email: agent.email,
    name: agent.name,
    role: agent.role,
    isActive: agent.isActive,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

export class LoginUseCase {
  constructor(
    private readonly agents: AgentRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService
  ) {}

  async execute(email: string, password: string): Promise<AuthResult> {
    const agent = await this.agents.findByEmail(email.trim().toLowerCase());
    if (!agent || !agent.isActive) {
      throw new Error("Credenciales inválidas");
    }

    const ok = await this.hasher.compare(password, agent.passwordHash);
    if (!ok) {
      throw new Error("Credenciales inválidas");
    }

    const tokens = this.tokens.issuePair({
      sub: agent.id,
      organizationId: agent.organizationId,
      role: agent.role,
    });

    return { agent: toPublicAgent(agent), tokens };
  }
}

export class RefreshTokenUseCase {
  constructor(
    private readonly agents: AgentRepository,
    private readonly tokens: TokenService
  ) {}

  async execute(refreshToken: string): Promise<TokenPair> {
    const claims = this.tokens.verifyRefresh(refreshToken);
    const agent = await this.agents.findById(claims.sub);
    if (!agent || !agent.isActive) {
      throw new Error("Sesión inválida");
    }

    return this.tokens.issuePair({
      sub: agent.id,
      organizationId: agent.organizationId,
      role: agent.role,
    });
  }
}
