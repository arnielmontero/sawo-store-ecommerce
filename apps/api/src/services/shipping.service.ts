import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getEasypost } from "../lib/easypost";
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
      ? { status: { in: [OrderStatus.SHIPPED, OrderStatus.DELIVERED] }, easypostTrackerId: { not: null } }
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
      where: { status: { in: [OrderStatus.SHIPPED, OrderStatus.DELIVERED] }, easypostTrackerId: { not: null } },
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

// ── EasyPost tracker mutations (unchanged behavior) ────────────────────

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
async function createTracker(trackingNumber: string, carrier: string | null) {
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

// Sets the tracking number and moves the order to SHIPPED in one step —
// matches how a fulfillment person actually works ("I packed it, here's the
// tracking number, mark it shipped"), rather than two separate calls. Also
// creates a real EasyPost tracker so the Deliveries page can show live
// status afterward; carrierOverride lets staff correct the auto-assigned
// carrier (see carrier.service.ts's assignCarrier) at ship time.
export async function shipOrder(orderId: number, trackingNumber: string, carrierOverride?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");

  const carrier = carrierOverride ?? order.carrier;
  const tracker = await createTracker(trackingNumber, carrier);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      trackingNumber,
      carrier,
      easypostTrackerId: tracker?.id ?? null,
      easypostTrackingUrl: tracker?.public_url ?? null,
      deliveryStatus: tracker?.status ?? null,
    },
  });

  return updateOrderStatus(orderId, OrderStatus.SHIPPED);
}

// Refreshes deliveryStatus from EasyPost's own tracker.status — called when
// the Deliveries page loads so staff see live progress rather than a
// snapshot from the moment it shipped. Best-effort per order: one failed
// lookup shouldn't block the rest of the list from refreshing.
export async function refreshDeliveryStatus(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.easypostTrackerId) return order;
  const easypost = await getEasypost();
  if (!easypost) return order;

  try {
    const tracker = await easypost.Tracker.retrieve(order.easypostTrackerId);
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { deliveryStatus: tracker.status },
    });
    if (tracker.status === "delivered" && order.status === OrderStatus.SHIPPED) {
      return updateOrderStatus(orderId, OrderStatus.DELIVERED);
    }
    return updated;
  } catch {
    return order;
  }
}

export async function refreshAllDeliveryStatuses() {
  const { shipments } = await listShipments("in-transit", {});
  for (const order of shipments) {
    await refreshDeliveryStatus(order.id);
  }
}
