import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
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

// Sets the tracking number and moves the order to SHIPPED in one step —
// matches how a fulfillment person actually works ("I packed it, here's the
// tracking number, mark it shipped"), rather than two separate calls.
export async function shipOrder(orderId: number, trackingNumber: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");

  await prisma.order.update({ where: { id: orderId }, data: { trackingNumber } });

  return updateOrderStatus(orderId, OrderStatus.SHIPPED);
}
