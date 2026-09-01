import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { canTransition } from "../lib/orderStateMachine";
import { priceCart, type CartLine } from "./pricing.service";
import { reserveStock, releaseStock, commitReservedStock, restockCommittedStock } from "./inventory.service";

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

export async function listOrders(filters: ListOrdersFilters = {}) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;

  const where: Prisma.OrderWhereInput = {
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
    },
  });
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
}

// Validates the cart, re-prices it server-side, reserves stock for every
// line, and creates a PENDING order — matching the diagram's checkout flow.
// If any line can't be reserved (out of stock / lost the race to someone
// else), every reservation already made in this call is rolled back so a
// failed checkout never leaves partial stock held.
export async function checkout(input: CheckoutInput) {
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

  if (nextStatus === OrderStatus.PAID) {
    // Converts the checkout-time reservation into a real deduction.
    for (const item of order.items) {
      await commitReservedStock(item.variantId, item.quantity);
    }
  } else if (nextStatus === OrderStatus.CANCELLED) {
    // CANCELLED is only reachable from PENDING (see orderStateMachine.ts),
    // where stock is still just reserved, not yet deducted — release it.
    for (const item of order.items) {
      await releaseStock(item.variantId, item.quantity);
    }
  } else if (nextStatus === OrderStatus.REFUNDED || nextStatus === OrderStatus.RETURNED) {
    // Both REFUNDED and RETURNED are only reachable from PAID/SHIPPED, where
    // stock was already committed (deducted) — restock it, not release a
    // reservation that no longer exists.
    for (const item of order.items) {
      await restockCommittedStock(item.variantId, item.quantity);
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: nextStatus, statusHistory: { create: { status: nextStatus } } },
  });
  return getOrderById(orderId);
}
