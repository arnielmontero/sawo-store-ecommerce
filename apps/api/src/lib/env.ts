import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  // The customer-facing storefront (apps/webshop) runs on its own origin —
  // kept separate from WEB_ORIGIN (the admin backoffice) so either can
  // change independently.
  WEBSHOP_ORIGIN: z.string().url().default("http://localhost:3001"),
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
  // Outgoing mail (order receipts, invoices). Optional for the same reason
  // as Stripe/EasyPost above — an unconfigured mailer leaves sending a
  // clearly-reported no-op (see lib/mailer.ts) rather than blocking the
  // whole server from starting over an integration a dev box may not need.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  // Whether to open the connection in TLS from the start. True for port 465
  // (implicit TLS); false for 587, which starts plaintext and upgrades via
  // STARTTLS — that's still encrypted, just negotiated after connecting.
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Envelope From, e.g. `Sawo Store Admin <admin@sawo.com>`.
  SMTP_FROM: z.string().optional(),
  // IMAP is configuration-only for now — nothing in this codebase reads
  // mail yet, but the connection details live here so they're in one place
  // when a reply-handling feature needs them.
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().optional(),
  IMAP_SECURE: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Fix your .env file (see .env.example) before starting the server.");
}

export const env = parsed.data;
