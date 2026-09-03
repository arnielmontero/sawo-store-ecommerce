import { prisma } from "./prisma";
import { getDeliveryProvider, getApiEnvironment } from "./credentials";
import { getRawStoreSettings } from "../services/settings.service";
import { assignCarrier } from "../services/carrier.service";
import { getShipEngineRateQuote, DEFAULT_WEIGHT_OZ } from "./shipengine";
import { REPRESENTATIVE_CITY_BY_COUNTRY } from "./representativeCities";

export interface ShippingQuoteInput {
  items: { variantId: number; quantity: number }[];
  shippingCountry: string;
  // Full street address — when omitted, the representative-city estimate
  // is used instead of a real customer-specific ShipEngine quote. Never
  // used for the final charged amount at checkout; only the early,
  // pre-full-address estimate.
  address?: { street1: string; city: string; state: string; postalCode: string };
}

export interface ShippingQuoteResult {
  shippingCents: number;
  // null whenever the $0 fallback fired (unconfigured ship-from, no
  // ShipEngine key, unmapped country, quote failure, or EasyPost active) —
  // distinguishes "we have no real quote" from "shipping is genuinely free".
  serviceName: string | null;
  isEstimate: boolean;
  // True when StoreSettings.apiEnvironment is SANDBOX — lets the storefront
  // show a small "test mode" note near the address fields so nobody
  // mistakes a sandbox quote (against a test ShipEngine account, any
  // address accepted) for a real, production shipping charge. Purely
  // informational — this flag never changes what's charged.
  isSandbox: boolean;
}

async function freeFallback(): Promise<ShippingQuoteResult> {
  return { shippingCents: 0, serviceName: null, isEstimate: false, isSandbox: (await getApiEnvironment()) === "SANDBOX" };
}

// Real shipping cost for checkout — ShipStation/ShipEngine only, matching
// the rest of this session's provider-scoped work (EasyPost has no
// rate-quote capability wired into this app). Never throws: every failure
// path (missing config, unmapped country, a ShipEngine error) falls back
// to $0 shipping rather than blocking a real customer's checkout — the
// same "never block a sale" principle shipping.service.ts's best-effort
// tracker functions already use, applied here to a public, unauthenticated
// caller where a thrown error would otherwise surface as a broken checkout
// page.
export async function getShippingQuote(input: ShippingQuoteInput): Promise<ShippingQuoteResult> {
  const provider = await getDeliveryProvider();
  if (provider !== "SHIPSTATION") return freeFallback();

  const settings = await getRawStoreSettings();
  if (
    !settings.shipFromName ||
    !settings.shipFromStreet1 ||
    !settings.shipFromCity ||
    !settings.shipFromState ||
    !settings.shipFromZip
  ) {
    console.warn("[shipping-quote] no ship-from address configured, falling back to free shipping");
    return freeFallback();
  }

  const destination = input.address ?? REPRESENTATIVE_CITY_BY_COUNTRY[input.shippingCountry];
  if (!destination) return freeFallback();

  try {
    const carrier = await assignCarrier(input.shippingCountry);

    const variants = await prisma.productVariant.findMany({
      where: { id: { in: input.items.map((i) => i.variantId) } },
      select: { id: true, weight: true },
    });
    const weightByVariantId = new Map(variants.map((v) => [v.id, v.weight]));
    const weightOunces = input.items.reduce((sum, item) => {
      const weight = weightByVariantId.get(item.variantId) ?? DEFAULT_WEIGHT_OZ;
      return sum + weight * item.quantity;
    }, 0);

    const result = await getShipEngineRateQuote({
      carrier,
      shipTo: {
        street1: destination.street1,
        city: destination.city,
        state: destination.state,
        postalCode: destination.postalCode,
        name: "Customer",
        country: input.shippingCountry,
      },
      shipFrom: {
        name: settings.shipFromName,
        phone: settings.shipFromPhone ?? undefined,
        street1: settings.shipFromStreet1,
        street2: settings.shipFromStreet2 ?? undefined,
        city: settings.shipFromCity,
        state: settings.shipFromState,
        postalCode: settings.shipFromZip,
        country: settings.shipFromCountry ?? "US",
      },
      weightOunces: weightOunces > 0 ? weightOunces : DEFAULT_WEIGHT_OZ,
    });

    return {
      shippingCents: result.amountCents,
      serviceName: result.serviceName,
      isEstimate: !input.address,
      isSandbox: (await getApiEnvironment()) === "SANDBOX",
    };
  } catch (err) {
    console.error("[shipping-quote] quote failed, falling back to free shipping:", err instanceof Error ? err.message : err);
    return freeFallback();
  }
}
