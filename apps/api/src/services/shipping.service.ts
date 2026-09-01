import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getEasypost } from "../lib/easypost";
import { HttpError } from "../middleware/errorHandler";
import { updateOrderStatus } from "./order.service";

// Orders that are paid but not yet shipped — the fulfillment queue.
export async function listPendingShipments() {
  return prisma.order.findMany({
    where: { status: OrderStatus.PAID },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
}

// Orders already shipped (or delivered) — the live-tracking view. Excludes
// terminal states unrelated to delivery (CANCELLED/REFUNDED before ever
// shipping) since those never got a tracker.
export async function listInTransitShipments() {
  return prisma.order.findMany({
    where: { status: { in: [OrderStatus.SHIPPED, OrderStatus.DELIVERED] }, easypostTrackerId: { not: null } },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

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
  const shipments = await listInTransitShipments();
  for (const order of shipments) {
    await refreshDeliveryStatus(order.id);
  }
  return listInTransitShipments();
}
