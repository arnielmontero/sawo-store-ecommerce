import { ApiEnvironment } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { clearCredentialsCache } from "../lib/credentials";
import { getConnectedCarrierDisplayNames } from "../lib/shipengine";

// Singleton row, always id: 1 — upsert so the first read/write creates it
// on demand instead of needing a separate seed step. Exported (unlike the
// rest of this file's internals) because shipping.service.ts's label
// purchase needs the real shipFrom* address fields, not the *Set-redacted
// shape getStoreSettings returns for the frontend.
export async function getRawStoreSettings() {
  return prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

// Unauthenticated subset for public-facing branding (storefront favicon/
// title, e.g.) — everything else on StoreSettings (carrier config, refund
// policy, credential-configured flags) is backoffice-only, so this
// deliberately returns just the two fields safe to expose with no auth.
export async function getPublicBranding() {
  const settings = await getRawStoreSettings();
  return { storeName: settings.storeName, logoUrl: settings.logoUrl };
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
    shipstationApiKeyTest,
    stripeSecretKeyLive,
    stripeWebhookSecretLive,
    easypostApiKeyLive,
    shipstationApiKeyLive,
    ...rest
  } = settings;

  // Only actually queried when ShipStation is the active provider — no
  // reason to call out to ShipEngine on every settings read while EasyPost
  // is selected. See lib/shipengine.ts: this reflects carriers genuinely
  // CONNECTED on the account (Settings → Carriers in the ShipEngine
  // dashboard), not a static guess — a carrier can be in our display-name
  // map and still not be usable if it isn't connected there.
  const shipEngineSupportedCarriers =
    settings.deliveryProvider === "SHIPSTATION" ? await getConnectedCarrierDisplayNames() : [];

  return {
    ...rest,
    stripeSecretKeyTestSet: Boolean(stripeSecretKeyTest),
    stripeWebhookSecretTestSet: Boolean(stripeWebhookSecretTest),
    easypostApiKeyTestSet: Boolean(easypostApiKeyTest),
    shipstationApiKeyTestSet: Boolean(shipstationApiKeyTest),
    stripeSecretKeyLiveSet: Boolean(stripeSecretKeyLive),
    stripeWebhookSecretLiveSet: Boolean(stripeWebhookSecretLive),
    easypostApiKeyLiveSet: Boolean(easypostApiKeyLive),
    shipstationApiKeyLiveSet: Boolean(shipstationApiKeyLive),
    shipEngineSupportedCarriers,
  };
}

export async function updateStoreSettings(input: {
  storeName?: string;
  logoUrl?: string | null;
  allowPartialRefunds?: boolean;
  defaultCarrier?: string;
  deliveryProvider?: string;
  shipFromName?: string;
  shipFromPhone?: string;
  shipFromStreet1?: string;
  shipFromStreet2?: string;
  shipFromCity?: string;
  shipFromState?: string;
  shipFromZip?: string;
  shipFromCountry?: string;
  apiEnvironment?: ApiEnvironment;
  stripeSecretKeyTest?: string;
  stripeWebhookSecretTest?: string;
  easypostApiKeyTest?: string;
  shipstationApiKeyTest?: string;
  stripeSecretKeyLive?: string;
  stripeWebhookSecretLive?: string;
  easypostApiKeyLive?: string;
  shipstationApiKeyLive?: string;
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
    shipstationApiKeyTest: input.shipstationApiKeyTest ? input.shipstationApiKeyTest.trim() : undefined,
    stripeSecretKeyLive: input.stripeSecretKeyLive ? input.stripeSecretKeyLive.trim() : undefined,
    stripeWebhookSecretLive: input.stripeWebhookSecretLive ? input.stripeWebhookSecretLive.trim() : undefined,
    easypostApiKeyLive: input.easypostApiKeyLive ? input.easypostApiKeyLive.trim() : undefined,
    shipstationApiKeyLive: input.shipstationApiKeyLive ? input.shipstationApiKeyLive.trim() : undefined,
  };

  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {
      storeName: input.storeName,
      logoUrl: input.logoUrl,
      allowPartialRefunds: input.allowPartialRefunds,
      defaultCarrier: input.defaultCarrier,
      deliveryProvider: input.deliveryProvider,
      shipFromName: input.shipFromName,
      shipFromPhone: input.shipFromPhone,
      shipFromStreet1: input.shipFromStreet1,
      shipFromStreet2: input.shipFromStreet2,
      shipFromCity: input.shipFromCity,
      shipFromState: input.shipFromState,
      shipFromZip: input.shipFromZip,
      shipFromCountry: input.shipFromCountry,
      apiEnvironment: input.apiEnvironment,
      ...trimmed,
    },
    create: {
      id: 1,
      storeName: input.storeName,
      logoUrl: input.logoUrl,
      allowPartialRefunds: input.allowPartialRefunds,
      defaultCarrier: input.defaultCarrier,
      deliveryProvider: input.deliveryProvider,
      shipFromName: input.shipFromName,
      shipFromPhone: input.shipFromPhone,
      shipFromStreet1: input.shipFromStreet1,
      shipFromStreet2: input.shipFromStreet2,
      shipFromCity: input.shipFromCity,
      shipFromState: input.shipFromState,
      shipFromZip: input.shipFromZip,
      shipFromCountry: input.shipFromCountry,
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
