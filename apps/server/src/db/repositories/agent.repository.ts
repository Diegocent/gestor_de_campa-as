import { asc, eq } from "drizzle-orm";
import type { Agent, AgentRepository, AgentWithSecret } from "@gestor/core";
import { db } from "../client.js";
import { agents } from "../schema.js";
import { mapAgent, mapAgentWithSecret } from "../mappers.js";

export class DrizzleAgentRepository implements AgentRepository {
  async findByEmail(email: string): Promise<AgentWithSecret | null> {
    const [row] = await db.select().from(agents).where(eq(agents.email, email)).limit(1);
    return row ? mapAgentWithSecret(row) : null;
  }

  async findById(id: string): Promise<Agent | null> {
    const [row] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    return row ? mapAgent(row) : null;
  }

  async listByOrganization(organizationId: string): Promise<Agent[]> {
    const rows = await db
      .select()
      .from(agents)
      .where(eq(agents.organizationId, organizationId))
      .orderBy(asc(agents.name));
    return rows.map(mapAgent);
  }

  async create(input: {
    organizationId: string;
    email: string;
    name: string;
    passwordHash: string;
    role: Agent["role"];
  }): Promise<Agent> {
    const [row] = await db
      .insert(agents)
      .values({
        organizationId: input.organizationId,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
      })
      .returning();
    return mapAgent(row!);
  }

  async update(
    id: string,
    input: {
      name?: string;
      role?: Agent["role"];
      isActive?: boolean;
      passwordHash?: string;
    }
  ): Promise<Agent> {
    const [row] = await db
      .update(agents)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return mapAgent(row!);
  }
}
