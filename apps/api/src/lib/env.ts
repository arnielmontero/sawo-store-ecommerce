import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  // Base URL this API is reachable at, used to build absolute URLs for
  // uploaded files (e.g. http://localhost:4000/uploads/xyz.png) — the
  // frontend runs on a different origin, so a relative path wouldn't resolve.
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  REFRESH_TOKEN_SECRET: z.string().min(16, "REFRESH_TOKEN_SECRET must be at least 16 characters"),
  // Optional here: these three can also be set (or overridden) from the
  // Configuration page, stored on StoreSettings — see lib/credentials.ts,
  // which resolves DB-first with these as the fallback. Stripe usage
  // (createPaymentIntent, etc.) still throws a clear error at call time if
  // neither source has a value, rather than crashing the whole server at
  // startup over a key an admin might configure through the UI instead.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // EasyPost (test mode) — carrier tracking, see lib/easypost.ts. Optional:
  // unset in dev leaves tracking creation a no-op (see shipping.service.ts)
  // rather than crashing the whole server over a nice-to-have integration.
  EASYPOST_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Fix your .env file (see .env.example) before starting the server.");
}

export const env = parsed.data;
