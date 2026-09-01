import { OrderStatus, ReturnRequestStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { refundOrder } from "./payment.service";
import { getOrderById } from "./order.service";
import { notifyReturnRequestPending, resolveReturnRequestNotification } from "./notification.service";

// Only orders that have actually been paid for (and haven't already
// resolved to a terminal refunded state) can have a return requested — same
// universe refundOrder itself accepts, checked again here so a request
// can't even be LOGGED against an order that could never be approved.
const RETURNABLE_STATUSES: OrderStatus[] = [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.PARTIALLY_REFUNDED];

export interface LogReturnRequestInput {
  orderId: number;
  reason: string;
  items: { orderItemId: number; quantity: number }[];
  loggedByName: string;
}

// Staff logs what a customer asked for (phone/email — there's no live
// customer session in this system yet, see checkout()) as a PENDING request
// that sits for review, rather than moving any money or stock immediately.
// Mirrors refundOrder's own item validation so a request can never be
// approved later only to fail validation at that point.
export async function logReturnRequest(input: LogReturnRequestInput) {
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
  if (!order) throw new HttpError(404, "Order not found");
  if (!RETURNABLE_STATUSES.includes(order.status)) {
    throw new HttpError(409, `Cannot request a return for an order in status ${order.status}`);
  }
  if (!input.reason.trim()) throw new HttpError(400, "A reason is required");
  if (input.items.length === 0) throw new HttpError(400, "At least one item is required");

  const itemsById = new Map(order.items.map((item) => [item.id, item]));
  for (const line of input.items) {
    const item = itemsById.get(line.orderItemId);
    if (!item || item.orderId !== input.orderId) {
      throw new HttpError(400, `Order item ${line.orderItemId} does not belong to this order`);
    }
    if (line.quantity <= 0 || line.quantity > item.quantity) {
      throw new HttpError(400, `Invalid quantity for order item ${line.orderItemId}`);
    }
  }

  const created = await prisma.returnRequest.create({
    data: {
      orderId: input.orderId,
      reason: input.reason.trim(),
      loggedByName: input.loggedByName,
      items: { create: input.items.map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity })) },
    },
  });

  await notifyReturnRequestPending({
    returnRequestId: created.id,
    orderId: order.id,
    orderReference: order.reference,
    reason: created.reason,
  });

  return getOrderById(input.orderId);
}

async function getPendingRequest(returnRequestId: number) {
  const request = await prisma.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: { items: { include: { orderItem: true } }, order: true },
  });
  if (!request) throw new HttpError(404, "Return request not found");
  if (request.status !== ReturnRequestStatus.PENDING) {
    throw new HttpError(409, `Return request is already ${request.status.toLowerCase()}`);
  }
  return request;
}

export async function rejectReturnRequest(returnRequestId: number, reviewNote: string, resolvedByName: string) {
  const request = await getPendingRequest(returnRequestId);

  await prisma.returnRequest.update({
    where: { id: request.id },
    data: {
      status: ReturnRequestStatus.REJECTED,
      reviewNote: reviewNote.trim() || null,
      resolvedByName,
      resolvedAt: new Date(),
    },
  });
  await resolveReturnRequestNotification(request.id);

  return getOrderById(request.orderId);
}

export interface ApproveReturnRequestInput {
  // Defaults to the sum of the requested items' unit prices — an admin can
  // override it (e.g. also covering original shipping), same discretion the
  // plain RefundPanel already allows.
  amountCents?: number;
  reviewNote?: string;
  resolvedByName: string;
}

// Approving is the one moment this whole flow actually moves money/stock —
// it hands the request's items straight to the existing, already-audited
// refundOrder() rather than re-implementing any of its Stripe/restock/
// double-restock-prevention logic. If refundOrder throws (e.g. Stripe
// rejects it), the request is left PENDING so it can be retried, instead of
// being silently marked approved for a refund that never actually happened.
export async function approveReturnRequest(returnRequestId: number, input: ApproveReturnRequestInput) {
  const request = await getPendingRequest(returnRequestId);

  const defaultAmountCents = request.items.reduce(
    (sum, line) => sum + line.orderItem.unitPriceCents * line.quantity,
    0
  );
  const amountCents = input.amountCents ?? defaultAmountCents;

  const { refundRecordId } = await refundOrder(request.orderId, {
    amountCents,
    items: request.items.map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity })),
  });

  await prisma.returnRequest.update({
    where: { id: request.id },
    data: {
      status: ReturnRequestStatus.APPROVED,
      reviewNote: input.reviewNote?.trim() || null,
      resolvedByName: input.resolvedByName,
      resolvedAt: new Date(),
      refundRecordId,
    },
  });
  await resolveReturnRequestNotification(request.id);

  return getOrderById(request.orderId);
}
