import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

// Una sola conexión por proceso. Neon-friendly: pool chico.
const queryClient = postgres(env.DATABASE_URL, {
  max: env.NODE_ENV === "production" ? 10 : 5,
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
export { schema };
