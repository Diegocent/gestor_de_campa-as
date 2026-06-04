import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "./client.js";
import { agents, organizations } from "./schema.js";

async function main() {
  console.log("[seed] Creando organización por defecto...");
  const [org] = await db
    .insert(organizations)
    .values({ slug: env.DEFAULT_ORG_SLUG, name: "Mi Empresa" })
    .onConflictDoNothing({ target: organizations.slug })
    .returning();

  const organizationId =
    org?.id ??
    (
      await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, env.DEFAULT_ORG_SLUG))
        .limit(1)
    )[0]!.id;

  const email = "admin@demo.com";
  const existing = await db.select().from(agents).where(eq(agents.email, email)).limit(1);

  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash("admin1234", 10);
    await db.insert(agents).values({
      organizationId,
      email,
      name: "Administrador",
      passwordHash,
      role: "admin",
    });
    console.log(`[seed] Agente admin creado → ${email} / admin1234`);
  } else {
    console.log("[seed] El agente admin ya existe.");
  }

  console.log("[seed] Listo.");
  process.exit(0);
}

main().catch((error) => {
  console.error("[seed] Error:", error);
  process.exit(1);
});
