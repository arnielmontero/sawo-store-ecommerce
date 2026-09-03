import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getEasypost } from "../lib/easypost";
import {
  createShipEngineTracker,
  getShipEngineTrackingStatus,
  toCarrierCode,
  parseShippingAddress,
  getConnectedCarrierNames,
  buyShipEngineLabel as buyShipEngineLabelLib,
  getShipEngineRateQuote,
  downloadAndStoreLabel,
  DEFAULT_WEIGHT_OZ,
} from "../lib/shipengine";
import { getDeliveryProvider } from "../lib/credentials";
import { getRawStoreSettings } from "./settings.service";
import { HttpError } from "../middleware/errorHandler";
import { updateOrderStatus } from "./order.service";
import { toXlsx } from "../lib/xlsx";
import { PAID_STALE_HOURS, SHIPPED_STALE_DAYS } from "../lib/staleOrderThresholds";

const PAGE_SIZE = 20;

export type ShipmentTab = "pending" | "in-transit" | "history";
export type ShipmentSortField = "createdAt" | "paidAt" | "updatedAt" | "totalCents";
export type OverdueReason = "paid_too_long" | "shipped_too_long" | null;

export interface ListShipmentsFilters {
  search?: string;
  // Multiple values = OR'd together, matching the multi-select checkbox
  // dropdowns in the admin UI (same convention as payment.service.ts).
  carrier?: string[];
  country?: string[];
  // Inclusive date range on createdAt (when the order was placed) — same
  // field and semantics as order.service.ts's ListOrdersFilters, so a date
  // range means the same thing here as it does on the Orders page.
  dateFrom?: string;
  dateTo?: string;
  sortBy?: ShipmentSortField;
  sortDir?: "asc" | "desc";
  page?: number;
}

// Tab -> base where clause. Shared by listShipments and exportShipmentsCsv
// so an export always matches exactly what's on screen, minus pagination —
// same pattern as order.service.ts's buildOrdersWhere.
function buildShipmentsWhere(tab: ShipmentTab, filters: ListShipmentsFilters): Prisma.OrderWhereInput {
  const base: Prisma.OrderWhereInput =
    tab === "pending"
      ? { status: OrderStatus.PAID }
      : tab === "in-transit"
      ? { status: { in: [OrderStatus.SHIPPED, OrderStatus.DELIVERED] }, trackingProvider: { not: null } }
      : { status: { in: [OrderStatus.DELIVERED, OrderStatus.RETURNED] } };

  return {
    ...base,
    ...(filters.carrier && filters.carrier.length > 0 ? { carrier: { in: filters.carrier } } : {}),
    ...(filters.country && filters.country.length > 0 ? { shippingCountry: { in: filters.country } } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            // dateTo is a calendar date from a date-picker (no time
            // component) — push it to the end of that day so "to 2026-09-01"
            // includes orders placed during that day, not only before
            // midnight. Matches order.service.ts's buildOrdersWhere.
            ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          OR: [
            { reference: { contains: filters.search } },
            { trackingNumber: { contains: filters.search } },
            { user: { email: { contains: filters.search } } },
          ],
        }
      : {}),
  };
}

// Overdue is computed at query time from paidAt/updatedAt, not stored — a
// cheap comparison against the shared thresholds (see staleOrderThresholds
// .ts), kept in lockstep with the same thresholds the notification inbox
// uses so the two can never disagree about what counts as overdue.
function computeOverdue(
  tab: ShipmentTab,
  order: { status: OrderStatus; paidAt: Date | null; updatedAt: Date }
): { isOverdue: boolean; overdueReason: OverdueReason } {
  if (tab === "pending" && order.paidAt) {
    const hoursSincePaid = (Date.now() - order.paidAt.getTime()) / (1000 * 60 * 60);
    if (hoursSincePaid > PAID_STALE_HOURS) return { isOverdue: true, overdueReason: "paid_too_long" };
  }
  if (tab === "in-transit" && order.status === OrderStatus.SHIPPED) {
    const daysSinceUpdate = (Date.now() - order.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > SHIPPED_STALE_DAYS) return { isOverdue: true, overdueReason: "shipped_too_long" };
  }
  return { isOverdue: false, overdueReason: null };
}

const SHIPMENT_SELECT = {
  id: true,
  reference: true,
  status: true,
  totalCents: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  shippingCountry: true,
  carrier: true,
  trackingNumber: true,
  easypostTrackingUrl: true,
  deliveryStatus: true,
  labelUrl: true,
  items: { select: { id: true, variantId: true, quantity: true, unitPriceCents: true } },
} satisfies Prisma.OrderSelect;

// Powers all three Deliveries tabs (Pending/In-Transit/History) through one
// shared query shape — search/carrier/country/sort/pagination all behave
// identically across tabs, only the base "which orders belong on this tab"
// where-clause differs. Mirrors payment.service.ts's listPayments.
export async function listShipments(tab: ShipmentTab, filters: ListShipmentsFilters = {}) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  // Pending defaults to oldest-paid-first (matches the original
  // listPendingShipments's createdAt-asc fulfillment-queue ordering); the
  // other tabs default to newest-first.
  const sortBy = filters.sortBy ?? (tab === "pending" ? "paidAt" : "createdAt");
  const sortDir = filters.sortDir ?? (tab === "pending" ? "asc" : "desc");
  const where = buildShipmentsWhere(tab, filters);

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: SHIPMENT_SELECT,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const shipments = rows.map((order) => ({ ...order, ...computeOverdue(tab, order) }));

  return {
    shipments,
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
  };
}

// ── Export ────────────────────────────────────────────────────────────

const EXPORT_HEADERS = [
  "Reference",
  "Status",
  "Country",
  "Carrier",
  "Tracking Number",
  "Total",
  "Currency",
  "Ordered At",
  "Paid At",
  "Delivery Status",
  "Overdue",
];

// Reuses buildShipmentsWhere so an export always matches exactly what the
// same tab/filters currently show on screen, minus pagination — same
// convention as order.service.ts's exportOrdersXlsx. Total is a real number
// so the sheet stays sortable/summable in Excel.
export async function exportShipmentsXlsx(tab: ShipmentTab, filters: ListShipmentsFilters = {}): Promise<Buffer> {
  const where = buildShipmentsWhere(tab, filters);
  const rows = await prisma.order.findMany({ where, select: SHIPMENT_SELECT, orderBy: { createdAt: "desc" } });

  const exportRows = rows.map((order) => {
    const { isOverdue } = computeOverdue(tab, order);
    return [
      order.reference,
      order.status,
      order.shippingCountry ?? "",
      order.carrier ?? "",
      order.trackingNumber ?? "",
      order.totalCents / 100,
      order.currency,
      order.createdAt.toISOString(),
      order.paidAt?.toISOString() ?? "",
      order.deliveryStatus ?? "",
      isOverdue ? "Yes" : "No",
    ];
  });

  return toXlsx(EXPORT_HEADERS, exportRows, "Deliveries");
}

// ── Summary stats ────────────────────────────────────────────────────

// Powers the Deliveries stats bar. Deliberately NOT derived from
// listShipments's paginated rows — like order.service.ts's
// getOrderStatistics, these counts must reflect the true totals regardless
// of whatever page/filter is currently open, or they'd be misleading.
export async function getShipmentStatistics() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [pendingCount, inTransitCount, deliveredThisWeekCount, shipTimeSample] = await Promise.all([
    prisma.order.count({ where: { status: OrderStatus.PAID } }),
    prisma.order.count({
      where: { status: { in: [OrderStatus.SHIPPED, OrderStatus.DELIVERED] }, trackingProvider: { not: null } },
    }),
    prisma.order.count({ where: { status: OrderStatus.DELIVERED, updatedAt: { gte: sevenDaysAgo } } }),
    // Avg paid->shipped time, computed in JS from a bounded sample rather
    // than a raw SQL AVG(TIMESTAMPDIFF(...)) — Prisma has no portable
    // "average of a date difference" aggregate, and a rough average over a
    // capped sample is enough for a stats-bar figure that doesn't need to
    // be exact to the second.
    prisma.order.findMany({
      where: {
        paidAt: { not: null },
        status: { in: [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.RETURNED] },
      },
      select: {
        paidAt: true,
        statusHistory: { where: { status: OrderStatus.SHIPPED }, select: { changedAt: true }, take: 1 },
      },
      take: 500,
    }),
  ]);

  const shipTimesMs = shipTimeSample
    .filter((o) => o.paidAt && o.statusHistory[0])
    .map((o) => o.statusHistory[0].changedAt.getTime() - o.paidAt!.getTime());
  const avgPaidToShipHours =
    shipTimesMs.length > 0
      ? shipTimesMs.reduce((sum, ms) => sum + ms, 0) / shipTimesMs.length / (1000 * 60 * 60)
      : null;

  return { pendingCount, inTransitCount, deliveredThisWeekCount, avgPaidToShipHours };
}

// ── Tracker mutations (provider-agnostic) ───────────────────────────────

// EasyPost test-mode trackers deterministically walk through pre_transit ->
// in_transit -> out_for_delivery -> delivered based on the tracking_code's
// hardcoded test suffix (see https://docs.easypost.com/docs/trackers#test-tracking-codes).
// A real carrier tracking number in production would instead progress from
// the carrier's own real-world scans — this fallback only matters in test
// mode, where "shipped just now" needs a code EasyPost recognizes as a demo
// tracker instead of an unrecognized real one stuck at "unknown".
const EASYPOST_TEST_TRACKING_CODE = "EZ2000000002";

// Creates a real EasyPost tracker (test mode) for the given tracking number,
// best-effort — a failure here (no API key configured, EasyPost down) never
// blocks the order actually being marked shipped, same "nice-to-have
// display detail" tradeoff as payment.service.ts's recordCardMetadata.
async function createEasyPostTracker(trackingNumber: string, carrier: string | null) {
  const easypost = await getEasypost();
  if (!easypost) return null;
  try {
    const isLikelyTestInput = process.env.NODE_ENV !== "production";
    const tracker = await easypost.Tracker.create({
      tracking_code: isLikelyTestInput ? EASYPOST_TEST_TRACKING_CODE : trackingNumber,
      carrier: carrier ?? undefined,
    });
    return tracker;
  } catch {
    return null;
  }
}

// Shared tail for both shipOrder (manual entry) and buyShipEngineLabel
// (auto-generated via a real label purchase) — writes the tracking fields
// onto the order and flips it to SHIPPED. Neither caller's remaining logic
// (how trackingNumber/carrier/tracking fields get produced) is duplicated
// here — this only covers the part both flows end with identically.
async function finalizeShipment(orderId: number, data: Prisma.OrderUpdateInput) {
  await prisma.order.update({ where: { id: orderId }, data });
  return updateOrderStatus(orderId, OrderStatus.SHIPPED);
}

// Sets the tracking number and moves the order to SHIPPED in one step —
// matches how a fulfillment person actually works ("I packed it, here's the
// tracking number, mark it shipped"), rather than two separate calls. Also
// registers the order with whichever provider is currently selected
// (StoreSettings.deliveryProvider) so the Deliveries page can show live
// status afterward; carrierOverride lets staff correct the auto-assigned
// carrier (see carrier.service.ts's assignCarrier) at ship time.
//
// This is the MANUAL-entry flow — the caller already has a tracking number
// from somewhere outside this app. For ShipStation/ShipEngine, the label
// purchase flow (buyShipEngineLabel below) that GENERATES a tracking number
// automatically is preferred; this function still exists because EasyPost
// has no purchase-a-label integration in this app, only tracking.
export async function shipOrder(orderId: number, trackingNumber: string, carrierOverride?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");

  const carrier = carrierOverride ?? order.carrier;
  const provider = await getDeliveryProvider();

  const data: Prisma.OrderUpdateInput = { trackingNumber, carrier };

  if (provider === "SHIPSTATION") {
    const ref = await createShipEngineTracker(trackingNumber, carrier);
    data.trackingProvider = ref ? "SHIPSTATION" : null;
    data.easypostTrackerId = null;
    data.easypostTrackingUrl = null;
    data.deliveryStatus = null;
  } else {
    const tracker = await createEasyPostTracker(trackingNumber, carrier);
    data.trackingProvider = tracker ? "EASYPOST" : null;
    data.easypostTrackerId = tracker?.id ?? null;
    data.easypostTrackingUrl = tracker?.public_url ?? null;
    data.deliveryStatus = tracker?.status ?? null;
  }

  return finalizeShipment(orderId, data);
}

// ── ShipEngine label purchase (ShipStation only) ────────────────────────

// No side effects, no ShipEngine API call — loads the order, runs the
// best-effort address parser, and returns the connected-carrier list, so
// the admin can review/edit the parsed address BEFORE any label is bought.
// Powers the "Buy label" review panel on the Deliveries Pending tab.
export async function previewLabelAddress(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");

  const parsed = parseShippingAddress(order.shippingAddress);
  const availableCarriers = await getConnectedCarrierNames();

  return { ...parsed, carrier: order.carrier, availableCarriers };
}

interface BuyLabelAddressOverride {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

// Shared by getLabelQuote and buyShipEngineLabel — both need the exact same
// carrier/shipTo/shipFrom/weight resolution, and a quote is only meaningful
// if it's guaranteed to describe the same shipment the purchase call right
// after it will actually buy. Throws the same validation errors either way
// (missing carrier, unconfigured ship-from address, unparseable address) so
// a quote request surfaces a problem exactly as early as a purchase would.
async function resolveShipmentInputs(orderId: number, carrierOverride?: string, addressOverride?: BuyLabelAddressOverride) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { variant: true } }, user: { select: { name: true, phone: true } } },
  });
  if (!order) throw new HttpError(404, "Order not found");

  const carrier = carrierOverride ?? order.carrier;
  if (!carrier) throw new HttpError(400, "This order has no carrier assigned — pick one before buying a label");

  const settings = await getRawStoreSettings();
  if (
    !settings.shipFromName ||
    !settings.shipFromStreet1 ||
    !settings.shipFromCity ||
    !settings.shipFromState ||
    !settings.shipFromZip
  ) {
    throw new HttpError(400, "Configure a ship-from address in Configuration before buying labels");
  }

  const parsed = { ...parseShippingAddress(order.shippingAddress), ...addressOverride };
  if (!parsed.street1 || !parsed.city || !parsed.state || !parsed.postalCode) {
    throw new HttpError(
      400,
      "Couldn't parse a complete address from this order — review and fill in the missing fields, then try again"
    );
  }

  const totalWeightOz = order.items.reduce(
    (sum, item) => sum + (item.variant.weight ?? DEFAULT_WEIGHT_OZ) * item.quantity,
    0
  );

  return {
    carrier,
    shipTo: {
      ...parsed,
      name: order.user?.name || "Customer",
      phone: order.user?.phone ?? undefined,
      country: order.shippingCountry ?? "US",
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
    weightOunces: totalWeightOz > 0 ? totalWeightOz : DEFAULT_WEIGHT_OZ,
  };
}

// Real price quote — NO purchase, NO tracking number generated, safe to
// call repeatedly while the admin reviews/edits the address in the "Buy
// label" panel. See lib/shipengine.ts's getShipEngineRateQuote. This is
// what makes "Confirm purchase" an informed decision instead of a blind
// one — the panel calls this whenever the reviewed carrier/address
// changes, showing the real price and service before any money moves.
export async function getLabelQuote(orderId: number, carrierOverride?: string, addressOverride?: BuyLabelAddressOverride) {
  const inputs = await resolveShipmentInputs(orderId, carrierOverride, addressOverride);
  return getShipEngineRateQuote(inputs);
}

// Buys a REAL ShipEngine label for this order, downloads the label PDF into
// this app's own uploads dir, and marks the order SHIPPED with the
// tracking number the purchase produced — this is the auto-generate flow
// requested to replace manual tracking-number entry for ShipStation
// orders. addressOverride carries whatever the admin edited in the review
// panel; when absent, the best-effort parse of order.shippingAddress is
// trusted as-is. Errors are NOT swallowed anywhere in this path (unlike
// shipOrder's best-effort tracker creation) — a label purchase spends real
// money, so a failure must reach the admin with a clear reason, never a
// silent no-op.
export async function buyShipEngineLabel(
  orderId: number,
  carrierOverride?: string,
  addressOverride?: BuyLabelAddressOverride
) {
  const inputs = await resolveShipmentInputs(orderId, carrierOverride, addressOverride);
  const result = await buyShipEngineLabelLib(inputs);
  const labelUrl = await downloadAndStoreLabel(result.labelPdfUrl);

  return finalizeShipment(orderId, {
    trackingNumber: result.trackingNumber,
    carrier: inputs.carrier,
    trackingProvider: "SHIPSTATION",
    labelPurchasedAt: new Date(),
    labelUrl,
    shipEngineLabelId: result.labelId,
    shippingCostCents: result.shipmentCostCents,
    shippingCostCurrency: result.shipmentCostCurrency,
    easypostTrackingUrl: result.trackingUrl,
    easypostTrackerId: null,
    deliveryStatus: null,
  });
}

// Refreshes deliveryStatus from whichever provider tracked this order at
// ship time (order.trackingProvider — set once in shipOrder, not re-derived
// from the current StoreSettings.deliveryProvider, since switching the
// provider later shouldn't change how an already-shipped order is tracked).
// Called when the Deliveries page loads so staff see live progress rather
// than a snapshot from the moment it shipped. Best-effort per order: one
// failed lookup shouldn't block the rest of the list from refreshing.
export async function refreshDeliveryStatus(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.trackingProvider) return order;

  try {
    const result = await getTrackingStatus(order);
    if (!result) return order;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveryStatus: result.status,
        // ShipEngine returns its own carrier-hosted tracking page per
        // lookup (unlike EasyPost's, which is fixed at tracker-creation
        // time) — refreshed here too so the link doesn't stay stale/null if
        // it wasn't available yet right at ship time.
        ...(result.trackingUrl ? { easypostTrackingUrl: result.trackingUrl } : {}),
      },
    });
    if (result.status === "delivered" && order.status === OrderStatus.SHIPPED) {
      return updateOrderStatus(orderId, OrderStatus.DELIVERED);
    }
    return updated;
  } catch {
    return order;
  }
}

async function getTrackingStatus(order: {
  trackingProvider: string | null;
  easypostTrackerId: string | null;
  carrier: string | null;
  trackingNumber: string | null;
}): Promise<{ status: string; trackingUrl: string | null } | null> {
  if (order.trackingProvider === "SHIPSTATION") {
    const carrierCode = toCarrierCode(order.carrier);
    if (!carrierCode || !order.trackingNumber) return null;
    const result = await getShipEngineTrackingStatus({ carrierCode, trackingNumber: order.trackingNumber });
    return result ? { status: result.status, trackingUrl: result.trackingUrl } : null;
  }

  if (!order.easypostTrackerId) return null;
  const easypost = await getEasypost();
  if (!easypost) return null;
  const tracker = await easypost.Tracker.retrieve(order.easypostTrackerId);
  return tracker.status ? { status: tracker.status, trackingUrl: null } : null;
}

export async function refreshAllDeliveryStatuses() {
  const { shipments } = await listShipments("in-transit", {});
  for (const order of shipments) {
    await refreshDeliveryStatus(order.id);
  }
}
