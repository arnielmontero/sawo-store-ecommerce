import { ApiEnvironment } from "@prisma/client";
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
  const {
    stripeSecretKeyTest,
    stripeWebhookSecretTest,
    easypostApiKeyTest,
    stripeSecretKeyLive,
    stripeWebhookSecretLive,
    easypostApiKeyLive,
    ...rest
  } = settings;
  return {
    ...rest,
    stripeSecretKeyTestSet: Boolean(stripeSecretKeyTest),
    stripeWebhookSecretTestSet: Boolean(stripeWebhookSecretTest),
    easypostApiKeyTestSet: Boolean(easypostApiKeyTest),
    stripeSecretKeyLiveSet: Boolean(stripeSecretKeyLive),
    stripeWebhookSecretLiveSet: Boolean(stripeWebhookSecretLive),
    easypostApiKeyLiveSet: Boolean(easypostApiKeyLive),
  };
}

export async function updateStoreSettings(input: {
  storeName?: string;
  logoUrl?: string | null;
  allowPartialRefunds?: boolean;
  defaultCarrier?: string;
  apiEnvironment?: ApiEnvironment;
  stripeSecretKeyTest?: string;
  stripeWebhookSecretTest?: string;
  easypostApiKeyTest?: string;
  stripeSecretKeyLive?: string;
  stripeWebhookSecretLive?: string;
  easypostApiKeyLive?: string;
}) {
  // An empty string means "field left blank" — the frontend never has the
  // real secret to send back (see getStoreSettings's *Set booleans), so a
  // blank submission must mean "don't touch this," not "clear it." Clearing
  // a credential is not exposed at all right now — there's no real need to
  // blank one out short of replacing it with a new key.
  const trimmed = {
    stripeSecretKeyTest: input.stripeSecretKeyTest ? input.stripeSecretKeyTest.trim() : undefined,
    stripeWebhookSecretTest: input.stripeWebhookSecretTest ? input.stripeWebhookSecretTest.trim() : undefined,
    easypostApiKeyTest: input.easypostApiKeyTest ? input.easypostApiKeyTest.trim() : undefined,
    stripeSecretKeyLive: input.stripeSecretKeyLive ? input.stripeSecretKeyLive.trim() : undefined,
    stripeWebhookSecretLive: input.stripeWebhookSecretLive ? input.stripeWebhookSecretLive.trim() : undefined,
    easypostApiKeyLive: input.easypostApiKeyLive ? input.easypostApiKeyLive.trim() : undefined,
  };

  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {
      storeName: input.storeName,
      logoUrl: input.logoUrl,
      allowPartialRefunds: input.allowPartialRefunds,
      defaultCarrier: input.defaultCarrier,
      apiEnvironment: input.apiEnvironment,
      ...trimmed,
    },
    create: {
      id: 1,
      storeName: input.storeName,
      logoUrl: input.logoUrl,
      allowPartialRefunds: input.allowPartialRefunds,
      defaultCarrier: input.defaultCarrier,
      apiEnvironment: input.apiEnvironment,
      ...trimmed,
    },
  });
  // So the very next payment/tracking call picks up a just-saved key or
  // environment switch instead of waiting out credentials.ts's cache TTL.
  if (input.apiEnvironment !== undefined || Object.values(trimmed).some(Boolean)) {
    clearCredentialsCache();
  }
  return getStoreSettings();
}
