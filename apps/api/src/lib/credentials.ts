import { prisma } from "./prisma";
import { env } from "./env";

// Resolves external-integration credentials with StoreSettings (admin UI,
// see settings.routes.ts) taking priority over .env — lets a deployment
// configured only via .env keep working unchanged, while Configuration can
// override any of them at runtime without a server restart.
//
// Cached briefly rather than reading .env on every Stripe/EasyPost call:
// these are read on the hot path (every payment intent, every "mark
// shipped"), and a few seconds of staleness after an admin saves a new key
// is an acceptable tradeoff for not hitting the DB every time. clearCredentialsCache()
// is called right after a save so the change is picked up on the very next
// request in practice, not after the TTL.
let cached: { stripeSecretKey?: string; stripeWebhookSecret?: string; easypostApiKey?: string } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5000;

async function getCredentials() {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });
  cached = {
    stripeSecretKey: settings?.stripeSecretKey || env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: settings?.stripeWebhookSecret || env.STRIPE_WEBHOOK_SECRET,
    easypostApiKey: settings?.easypostApiKey || env.EASYPOST_API_KEY,
  };
  cachedAt = Date.now();
  return cached;
}

export function clearCredentialsCache() {
  cached = null;
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
