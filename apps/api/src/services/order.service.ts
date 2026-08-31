import { OrderStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { canTransition } from "../lib/orderStateMachine";
import { priceCart, type CartLine } from "./pricing.service";
import { reserveStock, releaseStock, commitReservedStock, restockCommittedStock } from "./inventory.service";

export async function listOrders() {
  return prisma.order.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });
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

  await prisma.order.update({ where: { id: orderId }, data: { status: nextStatus } });
  return getOrderById(orderId);
}
