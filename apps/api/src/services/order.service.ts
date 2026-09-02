import { OrderStatus, PaymentMethod, Prisma, StockAdjustmentReason } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { canTransition } from "../lib/orderStateMachine";
import { toCsv } from "../lib/csv";
import { priceCart, type CartLine } from "./pricing.service";
import { reserveStock, releaseStock, commitReservedStock, restockCommittedStock } from "./inventory.service";
import { resolveStaleOrderNotifications } from "./notification.service";
import { assignCarrier } from "./carrier.service";
import { isPaymentMethodAllowed } from "./paymentMethodRule.service";

const PAGE_SIZE = 20;

export interface ListOrdersFilters {
  search?: string;
  status?: OrderStatus;
  // Inclusive date range on createdAt — both ends optional so a caller can
  // filter "from X" or "until Y" alone. Dates are passed as ISO strings from
  // the query param and turned into Date here.
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

// Shared by listOrders and exportOrdersCsv so the two can never drift apart
// — an export should always match exactly what the admin currently sees
// filtered to in the list, minus pagination.
function buildOrdersWhere(filters: ListOrdersFilters): Prisma.OrderWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { reference: { contains: filters.search } },
            { user: { email: { contains: filters.search } } },
          ],
        }
      : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
            // dateTo is a calendar date from a date-picker (no time
            // component) — push it to the end of that day so "to 2026-09-01"
            // includes orders placed during that day, not only before midnight.
            ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };
}

export async function listOrders(filters: ListOrdersFilters = {}) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const where = buildOrdersWhere(filters);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
  };
}

const REVENUE_STATUSES: OrderStatus[] = [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED];

// Powers the Order Statistics panel — computed over the FULL orders table,
// not just whatever page the admin currently has open, since a stats panel
// showing numbers that shift depending on pagination/filters would be
// actively misleading rather than just incomplete.
export async function getOrderStatistics() {
  const [totalOrders, revenueAgg, newClientCount, statusGroups] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES } },
      _sum: { totalCents: true },
      _count: true,
    }),
    prisma.order.count({ where: { isNewClient: true } }),
    prisma.order.groupBy({ by: ["status"], _count: true }),
  ]);

  const totalRevenueCents = revenueAgg._sum.totalCents ?? 0;
  const avgOrderValueCents = revenueAgg._count > 0 ? Math.round(totalRevenueCents / revenueAgg._count) : 0;

  const countsByStatus = Object.values(OrderStatus).map((status) => ({
    status,
    count: statusGroups.find((g) => g.status === status)?._count ?? 0,
  }));

  return { totalOrders, totalRevenueCents, avgOrderValueCents, newClientCount, countsByStatus };
}

const CSV_HEADERS = [
  "Reference",
  "Status",
  "Customer Email",
  "Payment Method",
  "Items",
  "Subtotal",
  "Discount",
  "Shipping",
  "Tax",
  "Total",
  "Refunded",
  "Currency",
  "New Client",
  "Tracking Number",
  "Ordered At",
];

// One row per order (not per item, unlike the Catalog CSV) — an order's
// line items are summarized into one "SKU x qty; SKU x qty" cell, since
// spreadsheet-per-order matches how admins actually use an orders export
// (reconciliation/accounting), not per-item detail. Respects the exact same
// filters as the on-screen list, via the shared buildOrdersWhere.
export async function exportOrdersCsv(filters: ListOrdersFilters = {}): Promise<string> {
  const where = buildOrdersWhere(filters);
  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { email: true } },
      items: { include: { variant: { select: { sku: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = orders.map((order) => [
    order.reference,
    order.status,
    order.user?.email ?? "",
    order.paymentMethod ?? "",
    order.items.map((item) => `${item.variant.sku} x${item.quantity}`).join("; "),
    (order.subtotalCents / 100).toFixed(2),
    (order.discountCents / 100).toFixed(2),
    (order.shippingCents / 100).toFixed(2),
    (order.taxCents / 100).toFixed(2),
    (order.totalCents / 100).toFixed(2),
    (order.refundedCents / 100).toFixed(2),
    order.currency,
    order.isNewClient ? "Yes" : "No",
    order.trackingNumber ?? "",
    order.createdAt.toISOString(),
  ]);

  return toCsv(CSV_HEADERS, rows);
}

// Orders currently sitting in PARTIALLY_REFUNDED — an in-between state
// where money has already moved back to the customer for part of the
// order, but the order itself hasn't been fully resolved (either topped off
// to a full refund, or left as-is). Surfaced as its own view so staff can
// see, at a glance, which customers/items are in this state rather than
// having to hunt for it inside each order individually.
export async function listHeldOrders() {
  const orders = await prisma.order.findMany({
    where: { status: OrderStatus.PARTIALLY_REFUNDED },
    include: {
      user: { select: { id: true, email: true } },
      items: { include: { variant: { select: { sku: true, product: { select: { title: true } } } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return orders.map((order) => ({
    id: order.id,
    reference: order.reference,
    user: order.user,
    totalCents: order.totalCents,
    refundedCents: order.refundedCents,
    remainingCents: order.totalCents - order.refundedCents,
    currency: order.currency,
    items: order.items.map((item) => ({
      id: item.id,
      productTitle: item.variant.product.title,
      sku: item.variant.sku,
      quantity: item.quantity,
    })),
  }));
}

export async function getOrdersForUser(userId: number) {
  return prisma.order.findMany({
    where: { userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrderById(id: number) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
      items: {
        include: {
          variant: {
            select: { id: true, sku: true, attributes: true, product: { select: { title: true } } },
          },
        },
      },
      statusHistory: { orderBy: { changedAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
      refunds: { include: { items: true }, orderBy: { createdAt: "desc" } },
      returnRequests: { include: { items: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

// Internal staff notes on an order (never shown to the customer). authorName
// is a plain-string snapshot of the admin's current name at write time
// rather than a live join, so a note stays legible even if that admin
// account is later renamed or removed.
export async function addOrderNote(orderId: number, body: string, authorName: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");

  await prisma.orderNote.create({ data: { orderId, body, authorName } });
  return getOrderById(orderId);
}

function generateReference() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${random}`;
}

export interface CheckoutInput {
  userId?: number;
  items: CartLine[];
  paymentMethod: PaymentMethod;
  shippingAddress?: string;
  shippingCountry?: string;
}

// Validates the cart, re-prices it server-side, reserves stock for every
// line, and creates a PENDING order — matching the diagram's checkout flow.
// If any line can't be reserved (out of stock / lost the race to someone
// else), every reservation already made in this call is rolled back so a
// failed checkout never leaves partial stock held.
export async function checkout(input: CheckoutInput) {
  if (!(await isPaymentMethodAllowed(input.shippingCountry, input.paymentMethod))) {
    throw new HttpError(
      409,
      `${input.paymentMethod} is not an accepted payment method for ${input.shippingCountry}`
    );
  }

  const pricing = await priceCart(input.items);

  const reservedSoFar: CartLine[] = [];
  try {
    for (const line of pricing.lines) {
      const reserved = await reserveStock(line.variantId, line.quantity);
      if (!reserved) {
        throw new HttpError(409, `Not enough stock for variant ${line.variantId}`);
      }
      reservedSoFar.push({ variantId: line.variantId, quantity: line.quantity });
    }
  } catch (err) {
    for (const line of reservedSoFar) {
      await releaseStock(line.variantId, line.quantity);
    }
    throw err;
  }

  const carrier = await assignCarrier(input.shippingCountry);

  const order = await prisma.order.create({
    data: {
      reference: generateReference(),
      status: OrderStatus.PENDING,
      paymentMethod: input.paymentMethod,
      subtotalCents: pricing.subtotalCents,
      discountCents: pricing.discountCents,
      shippingCents: pricing.shippingCents,
      taxCents: pricing.taxCents,
      totalCents: pricing.totalCents,
      shippingAddress: input.shippingAddress,
      shippingCountry: input.shippingCountry,
      carrier,
      userId: input.userId,
      items: {
        create: pricing.lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
      },
      statusHistory: { create: { status: OrderStatus.PENDING } },
    },
    include: { items: true },
  });

  return order;
}

// Enforces the state machine and applies the inventory side-effect that
// matches each transition (see diagram): PAID commits reservations to a
// real deduction; CANCELLED/REFUNDED release the hold; RETURNED restocks
// previously-deducted units.
export async function updateOrderStatus(orderId: number, nextStatus: OrderStatus) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return null;

  if (!canTransition(order.status, nextStatus)) {
    throw new HttpError(409, `Cannot transition order from ${order.status} to ${nextStatus}`);
  }

  const orderContext = { orderId: order.id, orderReference: order.reference };

  if (nextStatus === OrderStatus.PAID) {
    // Converts the checkout-time reservation into a real deduction.
    for (const item of order.items) {
      await commitReservedStock(item.variantId, item.quantity, orderContext);
    }
  } else if (nextStatus === OrderStatus.CANCELLED) {
    // CANCELLED is only reachable from PENDING (see orderStateMachine.ts),
    // where stock is still just reserved, not yet deducted — release it.
    for (const item of order.items) {
      await releaseStock(item.variantId, item.quantity);
    }
  } else if (
    (nextStatus === OrderStatus.REFUNDED && order.status !== OrderStatus.PARTIALLY_REFUNDED) ||
    nextStatus === OrderStatus.RETURNED
  ) {
    // Blanket "restock every item in full" — correct for RETURNED (always),
    // and for REFUNDED coming straight from PAID/SHIPPED (the plain,
    // no-items-specified full refund). NOT correct for REFUNDED coming from
    // PARTIALLY_REFUNDED: that path already did its own targeted restock in
    // payment.service.ts's refundOrder for each partial refund along the
    // way, so blanket-restocking here again would double-count those units.
    const reason =
      nextStatus === OrderStatus.RETURNED
        ? StockAdjustmentReason.ORDER_RETURN
        : StockAdjustmentReason.REFUND_RESTOCK;
    for (const item of order.items) {
      await restockCommittedStock(item.variantId, item.quantity, orderContext, reason);
    }
  }

  await setOrderStatus(orderId, nextStatus);
  return getOrderById(orderId);
}

// Just the status flip + history write, with NO inventory side-effect —
// updateOrderStatus (above) is the normal entry point and always pairs this
// with the transition-appropriate stock movement. Exported separately for
// refundOrder's partial-refund path, which needs to land on REFUNDED or
// PARTIALLY_REFUNDED after doing its OWN targeted restock (only the specific
// item quantities actually returned), not the blanket "restock every item in
// full" that updateOrderStatus would otherwise apply for REFUNDED.
export async function setOrderStatus(orderId: number, nextStatus: OrderStatus) {
  const current = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!canTransition(current.status, nextStatus)) {
    throw new HttpError(409, `Cannot transition order to ${nextStatus}`);
  }
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: nextStatus,
      statusHistory: { create: { status: nextStatus } },
      // Set once, the first time an order reaches PAID — never overwritten
      // afterward. Distinct from updatedAt (bumps on any field write), so
      // it's the only reliable "how long has this been paid" signal; see
      // shipping.service.ts's overdue calculation for why that distinction
      // matters.
      ...(nextStatus === OrderStatus.PAID && !current.paidAt ? { paidAt: new Date() } : {}),
    },
  });
  // The order just left whatever status it was in — any "still PENDING
  // after 24h" / "still SHIPPED after 7d" alert for it no longer applies,
  // regardless of which status it moved to.
  await resolveStaleOrderNotifications(orderId);
}
