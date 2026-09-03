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

  // OpenWA Gateway (servicio self-hosted aparte, https://github.com/rmyndharis/OpenWA)
  // NO es el paquete npm "@open-wa/wa-automate"; es un proyecto distinto con el
  // mismo nombre. apps/server le habla por REST y recibe eventos por webhook.
  OPENWA_GATEWAY_URL: z.string().default("http://localhost:2785"),
  OPENWA_GATEWAY_API_KEY: z.string().min(1, "OPENWA_GATEWAY_API_KEY es obligatorio"),
  OPENWA_GATEWAY_SESSION_NAME: z.string().default("gestor-campanas"),
  // URL a la que el contenedor de OpenWA debe llamar para entregarnos eventos.
  // Como apps/server corre en el host (no en Docker), en Docker Desktop se usa
  // host.docker.internal para que el contenedor alcance el puerto del host.
  OPENWA_GATEWAY_WEBHOOK_URL: z
    .string()
    .default("http://host.docker.internal:4000/webhooks/openwa"),
  OPENWA_GATEWAY_WEBHOOK_SECRET: z
    .string()
    .min(16, "OPENWA_GATEWAY_WEBHOOK_SECRET debe tener >= 16 chars"),

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
