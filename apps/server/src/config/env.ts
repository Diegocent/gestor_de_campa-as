import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Base de datos (PostgreSQL local / Neon en producción)
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatorio"),

  // Redis / BullMQ
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET debe tener >= 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET debe tener >= 16 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  // OpenWA (embedded, multiDevice)
  OPENWA_SESSION_ID: z.string().default("gestor-campanas"),
  OPENWA_MULTI_DEVICE: z.coerce.boolean().default(true),
  OPENWA_HEADLESS: z.coerce.boolean().default(true),

  // Limitador de tasa dinámico para campañas (BullMQ)
  RATE_LIMIT_MAX: z.coerce.number().default(10),
  RATE_LIMIT_DURATION_MS: z.coerce.number().default(300_000),

  // Organización por defecto (single-tenant en F1)
  DEFAULT_ORG_SLUG: z.string().default("default"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
