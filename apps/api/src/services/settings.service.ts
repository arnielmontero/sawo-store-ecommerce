import { prisma } from "../lib/prisma";
import { clearCredentialsCache } from "../lib/credentials";

// Singleton row, always id: 1 — upsert so the first read/write creates it
// on demand instead of needing a separate seed step.
async function getRawStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

// The raw secret fields never leave the server once saved — GET /settings
// (and everywhere else this is returned to the frontend) reports only
// whether each one is set, not its value, so Configuration can render
// "configured" vs. an empty field without a saved key ever round-tripping
// back into a browser tab. Only credentials.ts (server-side, used to build
// the actual Stripe/EasyPost clients) ever reads the real values.
export async function getStoreSettings() {
  const settings = await getRawStoreSettings();
  const { stripeSecretKey, stripeWebhookSecret, easypostApiKey, ...rest } = settings;
  return {
    ...rest,
    stripeSecretKeySet: Boolean(stripeSecretKey),
    stripeWebhookSecretSet: Boolean(stripeWebhookSecret),
    easypostApiKeySet: Boolean(easypostApiKey),
  };
}

export async function updateStoreSettings(input: {
  storeName?: string;
  logoUrl?: string | null;
  allowPartialRefunds?: boolean;
  defaultCarrier?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  easypostApiKey?: string;
}) {
  // An empty string means "field left blank" — the frontend never has the
  // real secret to send back (see getStoreSettings's *Set booleans), so a
  // blank submission must mean "don't touch this," not "clear it." Clearing
  // a credential is not exposed at all right now — there's no real need to
  // blank one out short of replacing it with a new key.
  const stripeSecretKey = input.stripeSecretKey ? input.stripeSecretKey.trim() : undefined;
  const stripeWebhookSecret = input.stripeWebhookSecret ? input.stripeWebhookSecret.trim() : undefined;
  const easypostApiKey = input.easypostApiKey ? input.easypostApiKey.trim() : undefined;

  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {
      storeName: input.storeName,
      logoUrl: input.logoUrl,
      allowPartialRefunds: input.allowPartialRefunds,
      defaultCarrier: input.defaultCarrier,
      stripeSecretKey,
      stripeWebhookSecret,
      easypostApiKey,
    },
    create: {
      id: 1,
      storeName: input.storeName,
      logoUrl: input.logoUrl,
      allowPartialRefunds: input.allowPartialRefunds,
      defaultCarrier: input.defaultCarrier,
      stripeSecretKey,
      stripeWebhookSecret,
      easypostApiKey,
    },
  });
  // So the very next payment/tracking call picks up a just-saved key
  // instead of waiting out credentials.ts's cache TTL.
  if (stripeSecretKey || stripeWebhookSecret || easypostApiKey) {
    clearCredentialsCache();
  }
  return getStoreSettings();
}
