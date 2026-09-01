import { prisma } from "./prisma";
import { env } from "./env";

// Resolves external-integration credentials against StoreSettings.apiEnvironment
// (admin UI, see settings.routes.ts): SANDBOX uses the *Test fields (falling
// back to .env, so a deployment configured only via .env keeps working
// unchanged), PRODUCTION uses the *Live fields with no .env fallback — a
// live credential is never silently pulled from a dev machine's .env file.
//
// Cached briefly rather than reading the DB on every Stripe/EasyPost call:
// these are read on the hot path (every payment intent, every "mark
// shipped"), and a few seconds of staleness after an admin saves a new key
// or flips the environment is an acceptable tradeoff for not hitting the DB
// every time. clearCredentialsCache() is called right after a save/switch so
// the change is picked up on the very next request in practice, not after
// the TTL.
interface ResolvedCredentials {
  environment: "SANDBOX" | "PRODUCTION";
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  easypostApiKey?: string;
}

let cached: ResolvedCredentials | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

async function getCredentials(): Promise<ResolvedCredentials> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  const environment = settings?.apiEnvironment ?? "SANDBOX";

  cached =
    environment === "PRODUCTION"
      ? {
          environment,
          stripeSecretKey: settings?.stripeSecretKeyLive || undefined,
          stripeWebhookSecret: settings?.stripeWebhookSecretLive || undefined,
          easypostApiKey: settings?.easypostApiKeyLive || undefined,
        }
      : {
          environment,
          stripeSecretKey: settings?.stripeSecretKeyTest || env.STRIPE_SECRET_KEY,
          stripeWebhookSecret: settings?.stripeWebhookSecretTest || env.STRIPE_WEBHOOK_SECRET,
          easypostApiKey: settings?.easypostApiKeyTest || env.EASYPOST_API_KEY,
        };
  cachedAt = Date.now();
  return cached;
}

export function clearCredentialsCache() {
  cached = null;
}

export async function getApiEnvironment() {
  return (await getCredentials()).environment;
}

export async function getStripeSecretKey() {
  return (await getCredentials()).stripeSecretKey;
}

export async function getStripeWebhookSecret() {
  return (await getCredentials()).stripeWebhookSecret;
}

export async function getEasypostApiKey() {
  return (await getCredentials()).easypostApiKey;
}
