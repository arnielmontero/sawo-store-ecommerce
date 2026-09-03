import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getShipstationApiKey } from "./credentials";
import { UPLOAD_DIR } from "./upload";
import { env } from "./env";

// ShipStation's current API is ShipEngine (api.shipengine.com) — the
// "ShipStation API key" saved in Configuration is a ShipEngine sandbox/
// production key (single key, no separate secret — see the Delivery
// provider section of settings.routes.ts). Auth is a plain API-Key header,
// not Bearer.
const SHIPENGINE_BASE_URL = "https://api.shipengine.com";

// ShipEngine has no persistent "tracker object" the way EasyPost does —
// tracking is looked up directly by carrier_code + tracking_number on every
// call, so there's nothing to "create" up front the way createTracker()
// does for EasyPost. This function exists anyway (mirroring
// easypost.ts/shipping.service.ts's createTracker shape) so shipOrder can
// call one createXTracker() per provider uniformly — see
// shipping.service.ts. It just validates the key is configured and returns
// the lookup coordinates that'll be used later by getTrackingStatus.
export interface ShipEngineTrackerRef {
  carrierCode: string;
  trackingNumber: string;
}

// ShipEngine identifies carriers by carrier_code (e.g. "stamps_com", "ups",
// "fedex", "dhl_express"), not the display names this app stores on
// Order.carrier (see apps/web/lib/constants.ts's CARRIER_OPTIONS — USPS,
// UPS, FedEx, DHL — which is where those values originate). USPS's code is
// "stamps_com" specifically because ShipEngine brokers USPS through
// Stamps.com — this is the one non-obvious mapping here, the rest just
// lowercase the name.
const CARRIER_CODE_MAP: Record<string, string> = {
  USPS: "stamps_com",
  UPS: "ups",
  FedEx: "fedex",
  DHL: "dhl_express",
};

export function toCarrierCode(carrier: string | null): string | null {
  if (!carrier) return null;
  return CARRIER_CODE_MAP[carrier] ?? null;
}

const CODE_TO_DISPLAY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(CARRIER_CODE_MAP).map(([display, code]) => [code, display])
);

// Carries the HTTP status through so callers can log a real cause (401 bad
// key, 403 endpoint not available on the account's plan — see the Tracking
// endpoint's "Advanced plan or higher" requirement in ShipEngine's docs, vs.
// a plain network failure) instead of every failure collapsing into the
// same silent null a missing key already produces.
class ShipEngineError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// planNote lets each call site describe what a 403 means for that specific
// endpoint (e.g. "Labels requires..." vs "Tracking requires...") since
// different ShipEngine endpoints can be gated by different plan tiers —
// generic enough to omit entirely for endpoints where the exact
// requirement isn't known.
async function shipEngineFetch<T = unknown>(
  urlPath: string,
  apiKey: string,
  init?: RequestInit,
  planNote?: string
): Promise<T> {
  const res = await fetch(`${SHIPENGINE_BASE_URL}${urlPath}`, {
    ...init,
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const reason =
      res.status === 401
        ? "invalid API key"
        : res.status === 403
        ? `not available on this ShipEngine account's plan${planNote ? ` (${planNote})` : ""}`
        : `HTTP ${res.status}`;
    throw new ShipEngineError(res.status, `ShipEngine request failed: ${reason}`);
  }
  return res.json() as Promise<T>;
}

// Which of this account's connected carriers ShipEngine will actually
// track — NOT a static guess. Per ShipEngine's own docs, even a carrier we
// know the code for won't track unless it's actually connected on the
// account making the request (Settings → Carriers in the ShipEngine
// dashboard), so this calls the real GET /v1/carriers endpoint rather than
// assuming every entry in CARRIER_CODE_MAP is available. Cached briefly —
// same tradeoff as credentials.ts's getCredentials — since this is read on
// every "Mark shipped" row render, not something that needs to be
// millisecond-fresh against an account's carrier connections, which change
// rarely.
let connectedCarriersCache: { carriers: string[]; cachedAt: number } | null = null;
const CONNECTED_CARRIERS_CACHE_TTL_MS = 60_000;

// Returns display names (e.g. "USPS", "UPS") — the same vocabulary as
// Order.carrier and CARRIER_OPTIONS — for carriers that are BOTH connected
// to this ShipEngine account AND ones this app knows the carrier_code
// mapping for (see CODE_TO_DISPLAY_NAME above). A carrier connected on
// ShipEngine but outside our small known set (e.g. a regional carrier not
// in CARRIER_CODE_MAP) is intentionally left out — this app has no display
// name/dropdown option for it yet, so surfacing it wouldn't be actionable.
export async function getConnectedCarrierDisplayNames(): Promise<string[]> {
  if (connectedCarriersCache && Date.now() - connectedCarriersCache.cachedAt < CONNECTED_CARRIERS_CACHE_TTL_MS) {
    return connectedCarriersCache.carriers;
  }

  const apiKey = await getShipstationApiKey();
  if (!apiKey) return [];

  try {
    const data = await shipEngineFetch<{ carriers?: { carrier_code: string }[] }>("/v1/carriers", apiKey);
    const carriers = (data.carriers ?? [])
      .map((c) => CODE_TO_DISPLAY_NAME[c.carrier_code])
      .filter((name): name is string => Boolean(name));
    connectedCarriersCache = { carriers, cachedAt: Date.now() };
    return carriers;
  } catch (err) {
    console.error("[shipengine] failed to list connected carriers:", err instanceof Error ? err.message : err);
    return [];
  }
}

// Best-effort, same tradeoff as easypost.ts's createTracker — a missing key
// or unmapped carrier never blocks the order actually being marked shipped,
// it just means this order can't be auto-tracked.
export async function createShipEngineTracker(
  trackingNumber: string,
  carrier: string | null
): Promise<ShipEngineTrackerRef | null> {
  const apiKey = await getShipstationApiKey();
  if (!apiKey) return null;
  const carrierCode = toCarrierCode(carrier);
  if (!carrierCode) return null;

  try {
    // Registers the shipment for tracking-update webhooks/polling on
    // ShipEngine's side — not strictly required before GET /v1/tracking
    // works, but matches ShipEngine's documented "start tracking" step so
    // this shipment shows up in their own dashboard too.
    await shipEngineFetch("/v1/tracking/start", apiKey, {
      method: "POST",
      body: JSON.stringify({ carrier_code: carrierCode, tracking_number: trackingNumber }),
    });
  } catch {
    // Non-fatal — GET /v1/tracking below works even if /start failed or was
    // a no-op (e.g. already registered for this tracking number).
  }

  return { carrierCode, trackingNumber };
}

export interface ShipEngineStatus {
  // Normalized to the same vocabulary shipping.service.ts already expects
  // from EasyPost's tracker.status ("pre_transit", "in_transit",
  // "delivered", etc.) — see STATUS_CODE_MAP below — so
  // refreshDeliveryStatus doesn't need a second "what does 'delivered'
  // look like from this provider" branch.
  status: string;
  // Carrier-hosted tracking page (e.g. usps.com/go/TrackConfirmAction),
  // returned directly in ShipEngine's tracking response — mirrors
  // EasyPost's tracker.public_url, so the Deliveries/order-detail "Track
  // package" link (see HistoryTab.tsx, InTransitTab.tsx, orders/[id]) can
  // work the same way regardless of provider.
  trackingUrl: string | null;
}

// ShipEngine's status_code is a short enum, not the free-text-ish strings
// EasyPost uses — mapped here to the vocabulary the rest of the app (in
// particular the "delivered" comparison in shipping.service.ts) already
// reads. See https://www.shipengine.com/docs/tracking/ for the full code
// list; unmapped/unknown codes fall through to "unknown".
const STATUS_CODE_MAP: Record<string, string> = {
  AC: "pre_transit", // Accepted
  IT: "in_transit",
  DE: "delivered",
  EX: "error", // Exception
  UN: "unknown",
  AT: "out_for_delivery", // Attempted delivery
  NY: "pre_transit", // Not yet in system
};

export async function getShipEngineTrackingStatus(ref: ShipEngineTrackerRef): Promise<ShipEngineStatus | null> {
  const apiKey = await getShipstationApiKey();
  if (!apiKey) return null;

  try {
    const data = await shipEngineFetch<{ status_code?: string; tracking_url?: string }>(
      `/v1/tracking?carrier_code=${encodeURIComponent(ref.carrierCode)}&tracking_number=${encodeURIComponent(
        ref.trackingNumber
      )}`,
      apiKey,
      undefined,
      "Tracking requires Advanced plan or higher"
    );
    const statusCode = data?.status_code;
    return {
      status: (statusCode && STATUS_CODE_MAP[statusCode]) || "unknown",
      trackingUrl: data?.tracking_url ?? null,
    };
  } catch (err) {
    // Logged (not swallowed) — a missing/unmapped carrier already returns
    // null earlier without reaching here, so anything caught here is a real
    // API failure (bad key, wrong plan tier, ShipEngine down) worth seeing
    // in server logs rather than silently looking identical to "not
    // configured yet." refreshDeliveryStatus's caller still treats a null
    // return the same safe way either way — this only affects visibility.
    console.error("[shipengine] tracking lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Label purchase ───────────────────────────────────────────────────────

export interface ParsedAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
}

const EMPTY_PARSED_ADDRESS: ParsedAddress = { street1: "", city: "", state: "", postalCode: "" };

// Order.shippingAddress is a single free-text line typed at checkout, e.g.
// "12 Maple Lane, Portland, OR 97201" (confirmed against real seed data and
// a live order — this app has no structured checkout address fields today,
// see schema.prisma's Order model comments). Best-effort split, not a real
// address parser: the last comma-separated segment is assumed to be
// "ST ZIP", the second-to-last the city, everything before that the
// street. Returns all-empty fields (not a throw) on no match — this is a
// starting point for the mandatory admin-review step before a label is
// purchased (see shipping.service.ts's previewLabelAddress/buyShipEngineLabel),
// not a hard requirement to get right on the first try.
export function parseShippingAddress(raw: string | null): ParsedAddress {
  if (!raw) return { ...EMPTY_PARSED_ADDRESS };
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return { ...EMPTY_PARSED_ADDRESS };

  const stateZipMatch = parts[parts.length - 1].match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/i);
  if (!stateZipMatch) return { ...EMPTY_PARSED_ADDRESS };

  const city = parts[parts.length - 2];
  const street1 = parts.slice(0, parts.length - 2).join(", ");
  if (!city || !street1) return { ...EMPTY_PARSED_ADDRESS };

  return {
    street1,
    city,
    state: stateZipMatch[1].toUpperCase(),
    postalCode: stateZipMatch[2],
  };
}

// One sensible default service per carrier so v1 doesn't need a rate-
// shopping/service-picker UI — the user asked for "buy label," not
// "compare rates." Falls back to the account's first available service for
// that carrier if the preferred code isn't actually offered.
const DEFAULT_SERVICE_BY_CARRIER: Record<string, string> = {
  stamps_com: "usps_ground_advantage",
  ups: "ups_ground",
  fedex: "fedex_ground",
  dhl_express: "dhl_express_worldwide",
};

// Package weight fallback (1 lb) when a line item's variant has no weight
// set — see ProductVariant.weight's schema comment. Exported so
// shipping.service.ts's per-order weight sum uses the same constant rather
// than a second hardcoded number.
export const DEFAULT_WEIGHT_OZ = 16;

interface ConnectedCarrier {
  carrierCode: string;
  carrierId: string;
  displayName: string;
  services: { serviceCode: string; name: string }[];
}

// Richer than getConnectedCarrierDisplayNames above (which only returns
// display-name strings for the carrier-dropdown-filtering use case) —
// label purchase needs carrier_id (account-specific, e.g. "se-6806713",
// NOT derivable from carrier_code) and each carrier's services[] to pick a
// default service code from. Separate cache var so
// getConnectedCarrierDisplayNames's existing return contract (consumed by
// settings.service.ts) doesn't change.
let connectedCarriersFullCache: { carriers: ConnectedCarrier[]; cachedAt: number } | null = null;

async function getConnectedCarriers(): Promise<ConnectedCarrier[]> {
  if (
    connectedCarriersFullCache &&
    Date.now() - connectedCarriersFullCache.cachedAt < CONNECTED_CARRIERS_CACHE_TTL_MS
  ) {
    return connectedCarriersFullCache.carriers;
  }

  const apiKey = await getShipstationApiKey();
  if (!apiKey) return [];

  const data = await shipEngineFetch<{
    carriers?: {
      carrier_id: string;
      carrier_code: string;
      services: { service_code: string; name: string }[];
    }[];
  }>("/v1/carriers", apiKey);

  const carriers = (data.carriers ?? [])
    .map((c) => {
      const displayName = CODE_TO_DISPLAY_NAME[c.carrier_code];
      if (!displayName) return null;
      return {
        carrierCode: c.carrier_code,
        carrierId: c.carrier_id,
        displayName,
        services: (c.services ?? []).map((s) => ({ serviceCode: s.service_code, name: s.name })),
      };
    })
    .filter((c): c is ConnectedCarrier => c !== null);

  connectedCarriersFullCache = { carriers, cachedAt: Date.now() };
  return carriers;
}

// Display names of connected carriers, for the label-preview endpoint's
// carrier <select> — reuses getConnectedCarriers's richer lookup so the
// preview and the actual purchase always agree on what's connected.
export async function getConnectedCarrierNames(): Promise<string[]> {
  const carriers = await getConnectedCarriers();
  return carriers.map((c) => c.displayName);
}

function pickServiceCode(carrier: ConnectedCarrier): string | null {
  const preferred = DEFAULT_SERVICE_BY_CARRIER[carrier.carrierCode];
  if (preferred && carrier.services.some((s) => s.serviceCode === preferred)) return preferred;
  return carrier.services[0]?.serviceCode ?? null;
}

export interface ShipEngineLabelPurchaseInput {
  carrier: string; // display name, e.g. "UPS" — same vocabulary as Order.carrier
  shipTo: ParsedAddress & { name: string; phone?: string; country: string };
  shipFrom: ParsedAddress & { name: string; phone?: string; country: string };
  weightOunces: number;
}

export interface ShipEngineLabelResult {
  labelId: string;
  trackingNumber: string;
  trackingUrl: string | null;
  shipmentCostCents: number | null;
  shipmentCostCurrency: string | null;
  labelPdfUrl: string; // ShipEngine's own hosted URL — fetched once by downloadAndStoreLabel, not stored directly (can expire)
}

function toShipEngineAddress(addr: ParsedAddress & { name: string; phone?: string; country: string }) {
  return {
    name: addr.name,
    phone: addr.phone,
    address_line1: addr.street1,
    address_line2: addr.street2,
    city_locality: addr.city,
    state_province: addr.state,
    postal_code: addr.postalCode,
    country_code: addr.country,
    // Defaulted true unconditionally — this is a consumer storefront, and
    // there's no per-order residential/commercial flag to consult. Not
    // exposed in the UI.
    address_residential_indicator: "yes",
  };
}

// Resolves an input's carrier + service into the pieces both getRateQuote
// and buyShipEngineLabel need — kept in one place so a quote and the
// purchase that follows it are guaranteed to resolve to the exact same
// carrier/service, never silently drifting between the two calls.
async function resolveCarrierAndService(carrierDisplayName: string) {
  const carriers = await getConnectedCarriers();
  const carrier = carriers.find((c) => c.displayName === carrierDisplayName);
  if (!carrier) {
    throw new Error(`${carrierDisplayName} isn't connected on this ShipEngine account — pick a connected carrier`);
  }
  const serviceCode = pickServiceCode(carrier);
  if (!serviceCode) {
    throw new Error(`${carrierDisplayName} has no available service on this ShipEngine account`);
  }
  return { carrier, serviceCode };
}

function buildShipmentBody(
  carrierId: string,
  serviceCode: string,
  input: Pick<ShipEngineLabelPurchaseInput, "shipTo" | "shipFrom" | "weightOunces">
) {
  return {
    shipment: {
      carrier_id: carrierId,
      service_code: serviceCode,
      ship_to: toShipEngineAddress(input.shipTo),
      ship_from: toShipEngineAddress(input.shipFrom),
      packages: [{ weight: { value: input.weightOunces, unit: "ounce" } }],
    },
  };
}

export interface ShipEngineRateQuote {
  serviceName: string;
  amountCents: number;
  currency: string;
  estimatedDeliveryDate: string | null;
  deliveryDays: number | null;
}

// Real price quote, NO purchase, NO tracking number generated — safe to
// call as often as needed while an admin is reviewing an address, unlike
// buyShipEngineLabel which spends real money every time it succeeds. Lets
// the "Buy label" review panel show an actual price/service before the
// admin commits, instead of confirming a purchase blind (see
// shipping.service.ts's previewLabelAddress, which now calls this once a
// carrier + address are selected).
export async function getShipEngineRateQuote(
  input: Pick<ShipEngineLabelPurchaseInput, "carrier" | "shipTo" | "shipFrom" | "weightOunces">
): Promise<ShipEngineRateQuote> {
  const apiKey = await getShipstationApiKey();
  if (!apiKey) throw new Error("ShipStation/ShipEngine API key isn't configured");

  const { carrier, serviceCode } = await resolveCarrierAndService(input.carrier);
  const body = {
    rate_options: { carrier_ids: [carrier.carrierId], service_codes: [serviceCode] },
    shipment: buildShipmentBody(carrier.carrierId, serviceCode, input).shipment,
  };

  const data = await shipEngineFetch<{
    rate_response?: {
      rates?: {
        service_type: string;
        shipping_amount: { amount: number; currency: string };
        estimated_delivery_date: string | null;
        delivery_days: number | null;
      }[];
    };
  }>("/v1/rates", apiKey, { method: "POST", body: JSON.stringify(body) }, "Rates requires a paid ShipEngine plan");

  const rate = data.rate_response?.rates?.[0];
  if (!rate) throw new Error(`ShipEngine didn't return a rate for ${input.carrier} to this address`);

  return {
    serviceName: rate.service_type,
    amountCents: Math.round(rate.shipping_amount.amount * 100),
    currency: rate.shipping_amount.currency,
    estimatedDeliveryDate: rate.estimated_delivery_date,
    deliveryDays: rate.delivery_days,
  };
}

// Buys a REAL label — unlike createShipEngineTracker/getShipEngineTrackingStatus
// above, this does NOT swallow errors to null. A label purchase is a paid,
// user-initiated action; the caller (shipping.service.ts) must see the real
// failure reason (bad address, no carrier match, 401/403, etc.) to surface
// it to the admin rather than silently no-op.
export async function buyShipEngineLabel(input: ShipEngineLabelPurchaseInput): Promise<ShipEngineLabelResult> {
  const apiKey = await getShipstationApiKey();
  if (!apiKey) throw new Error("ShipStation/ShipEngine API key isn't configured");

  const { carrier, serviceCode } = await resolveCarrierAndService(input.carrier);
  const body = buildShipmentBody(carrier.carrierId, serviceCode, input);

  const data = await shipEngineFetch<{
    label_id: string;
    tracking_number: string;
    shipment_cost?: { amount: number; currency: string };
    label_download?: { pdf?: string; href?: string };
  }>(
    "/v1/labels",
    apiKey,
    { method: "POST", body: JSON.stringify(body) },
    "Labels requires a paid ShipEngine plan"
  );

  const labelPdfUrl = data.label_download?.pdf ?? data.label_download?.href;
  if (!labelPdfUrl) throw new Error("ShipEngine didn't return a label file for this purchase");

  return {
    labelId: data.label_id,
    trackingNumber: data.tracking_number,
    trackingUrl: null, // Labels' response doesn't include a tracking page URL — the next tracking refresh (getShipEngineTrackingStatus) fills this in.
    shipmentCostCents: data.shipment_cost ? Math.round(data.shipment_cost.amount * 100) : null,
    shipmentCostCurrency: data.shipment_cost?.currency ?? null,
    labelPdfUrl,
  };
}

// Downloads the provider-hosted label PDF and writes it into this app's own
// uploads directory, returning our own servable URL — ShipEngine's
// label_download URLs are not guaranteed to stay valid indefinitely, so the
// order should never point at one directly. Deliberately NOT routed
// through multer (see lib/upload.ts): this is an outbound server-to-server
// fetch of provider-hosted bytes, not an incoming multipart upload request.
export async function downloadAndStoreLabel(labelPdfUrl: string): Promise<string> {
  const res = await fetch(labelPdfUrl);
  if (!res.ok) throw new Error(`Failed to download label PDF: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `${crypto.randomUUID()}.pdf`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `${env.API_BASE_URL}/uploads/${filename}`;
}
