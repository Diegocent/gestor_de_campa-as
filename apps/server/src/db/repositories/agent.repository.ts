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
}
