import Stripe from "stripe";
import { OrderStatus, Prisma, StockAdjustmentReason } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getStripe } from "../lib/stripe";
import { HttpError } from "../middleware/errorHandler";
import { getOrderById, setOrderStatus, updateOrderStatus } from "./order.service";
import { restockCommittedStock } from "./inventory.service";
import { getStoreSettings } from "./settings.service";

// Creates (or reuses, on retry) a Stripe PaymentIntent for an order.
//
// Idempotency: paymentAttemptCount is incremented for this call, and
// `${orderId}-${attemptCount}` is passed as Stripe's own idempotency key.
// If the client retries the exact same attempt (e.g. a network drop after
// Stripe received the request but before the response arrived), Stripe
// itself recognizes the repeated key and returns the original PaymentIntent
// instead of creating a second one — no double-charge risk.
export async function createPaymentIntent(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== OrderStatus.PENDING) {
    throw new HttpError(409, `Cannot create a payment intent for an order in status ${order.status}`);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { paymentAttemptCount: { increment: 1 } },
  });

  const idempotencyKey = `${orderId}-${updated.paymentAttemptCount}`;

  const stripe = await getStripe();
  const intent = await stripe.paymentIntents.create(
    {
      amount: updated.totalCents,
      currency: updated.currency,
      metadata: { orderId: String(orderId) },
    },
    { idempotencyKey }
  );

  await prisma.order.update({
    where: { id: orderId },
    data: { stripePaymentIntentId: intent.id },
  });

  return { clientSecret: intent.client_secret };
}

// Pulls card brand/last4 from Stripe's own expanded payment_method — never
// the raw card number, which this app's Stripe integration (PaymentIntents
// API, card entered client-side against Stripe's own Elements/SDK) never
// receives or has PCI scope over in the first place. Best-effort: a webhook
// failure here shouldn't block the order actually being marked PAID, so
// errors are swallowed rather than thrown.
async function recordCardMetadata(orderId: number, intent: Stripe.PaymentIntent) {
  try {
    const paymentMethodId =
      typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
    if (!paymentMethodId) return;

    const stripe = await getStripe();
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    await prisma.order.update({
      where: { id: orderId },
      data: {
        cardBrand: paymentMethod.card?.brand ?? null,
        cardLast4: paymentMethod.card?.last4 ?? null,
        paymentStatus: intent.status,
      },
    });
  } catch {
    // Card metadata is a nice-to-have display detail, not load-bearing for
    // the order's own state — never let this block the real payment flow.
  }
}

// Verifies the webhook's Stripe signature (proves the request really came
// from Stripe, not a forged "payment succeeded" call from anyone who finds
// the endpoint), then checks the event.id against ProcessedWebhookEvent
// before doing anything — Stripe redelivers events on any ambiguous
// response, so the same event.id can arrive more than once.
export async function handleStripeWebhook(rawBody: Buffer, signature: string, webhookSecret: string) {
  let event: Stripe.Event;
  try {
    // Static namespace — signature verification is pure HMAC over the
    // webhook secret, no live API key/network call needed, so this doesn't
    // go through getStripe() (which requires a configured secret key).
    event = Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new HttpError(400, "Invalid webhook signature");
  }

  const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({ where: { id: event.id } });
  if (alreadyProcessed) return;

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = Number(intent.metadata.orderId);
    if (orderId) {
      await recordCardMetadata(orderId, intent);
      await updateOrderStatus(orderId, OrderStatus.PAID);
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = Number(intent.metadata.orderId);
    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: intent.status,
          paymentDeclineCode: intent.last_payment_error?.decline_code ?? intent.last_payment_error?.code ?? null,
        },
      });
      await updateOrderStatus(orderId, OrderStatus.CANCELLED);
    }
  }

  // Recorded last, after the side-effect succeeds — if updateOrderStatus
  // throws, the event is NOT marked processed, so Stripe's retry can still
  // succeed on a later delivery instead of being silently swallowed.
  await prisma.processedWebhookEvent.create({ data: { id: event.id, type: event.type } });
}

const PAGE_SIZE = 20;

export type PaymentSortField = "createdAt" | "totalCents" | "paymentAttemptCount";

export interface ListPaymentsFilters {
  search?: string;
  sortBy?: PaymentSortField;
  sortDir?: "asc" | "desc";
  page?: number;
}

// Admin payments view — orders that have actually gone through payment
// processing (a PaymentIntent was created), so PENDING orders that never
// got as far as checkout's payment step don't clutter the list.
export async function listPayments(filters: ListPaymentsFilters = {}) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const sortBy = filters.sortBy ?? "createdAt";
  const sortDir = filters.sortDir === "asc" ? "asc" : "desc";

  const where: Prisma.OrderWhereInput = {
    stripePaymentIntentId: { not: null },
    ...(filters.search
      ? {
          OR: [
            { reference: { contains: filters.search } },
            { stripePaymentIntentId: { contains: filters.search } },
            { user: { email: { contains: filters.search } } },
          ],
        }
      : {}),
  };

  const [payments, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        reference: true,
        status: true,
        paymentMethod: true,
        totalCents: true,
        currency: true,
        stripePaymentIntentId: true,
        paymentAttemptCount: true,
        createdAt: true,
      },
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    payments,
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
  };
}

export interface RefundInput {
  // Omitted = refund the full remaining balance (totalCents - refundedCents)
  // — this is the original, pre-partial-refund behavior, still the default
  // for every existing caller that doesn't pass an amount.
  amountCents?: number;
  // Which order items/quantities to restock as a result of THIS refund.
  // Omitted = restock nothing (e.g. a goodwill partial refund where nothing
  // is actually being returned) — restocking is never inferred from the
  // dollar amount, only from an explicit item list, so inventory can't
  // silently drift from what was physically returned.
  items?: { orderItemId: number; quantity: number }[];
}

// DELIVERED is included because "it arrived and the customer wants to
// return/refund it" is the single most common real-world return case — a
// refund isn't limited to orders still in flight.
const REFUNDABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.PARTIALLY_REFUNDED,
];

export async function refundOrder(orderId: number, input: RefundInput = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, refunds: { include: { items: true } } },
  });
  if (!order) throw new HttpError(404, "Order not found");
  if (!REFUNDABLE_STATUSES.includes(order.status)) {
    throw new HttpError(409, `Cannot refund an order in status ${order.status}`);
  }
  if (!order.stripePaymentIntentId) {
    throw new HttpError(409, "Order has no associated payment to refund");
  }

  const remainingCents = order.totalCents - order.refundedCents;
  const amountCents = input.amountCents ?? remainingCents;

  if (amountCents <= 0) {
    throw new HttpError(409, "Order has no remaining balance to refund");
  }
  if (amountCents > remainingCents) {
    throw new HttpError(409, `Cannot refund more than the remaining balance of ${remainingCents} cents`);
  }

  const isPartial = amountCents < remainingCents;
  if (isPartial) {
    const settings = await getStoreSettings();
    if (!settings.allowPartialRefunds) {
      throw new HttpError(409, "Partial refunds are disabled — enable them in Configuration to refund a partial amount.");
    }
  }

  // Already-restocked quantity per item, across every prior refund on this
  // order — needed both to cap how much MORE can be restocked now (can't
  // restock the same physical units twice across multiple partial refunds)
  // and to compute the "no items specified" default correctly.
  const alreadyRestockedByItem = new Map<number, number>();
  for (const refund of order.refunds) {
    for (const line of refund.items) {
      alreadyRestockedByItem.set(line.orderItemId, (alreadyRestockedByItem.get(line.orderItemId) ?? 0) + line.quantity);
    }
  }

  // Validate the restock list BEFORE calling Stripe — a bad item/quantity
  // should never leave us having already charged Stripe for a refund we
  // then fail to record correctly.
  const itemsById = new Map(order.items.map((item) => [item.id, item]));
  for (const line of input.items ?? []) {
    const item = itemsById.get(line.orderItemId);
    if (!item || item.orderId !== orderId) {
      throw new HttpError(400, `Order item ${line.orderItemId} does not belong to this order`);
    }
    const remainingRestockable = item.quantity - (alreadyRestockedByItem.get(line.orderItemId) ?? 0);
    if (line.quantity <= 0 || line.quantity > remainingRestockable) {
      throw new HttpError(
        400,
        `Invalid restock quantity for order item ${line.orderItemId} — only ${remainingRestockable} unit(s) remain restockable`
      );
    }
  }

  const stripe = await getStripe();
  const stripeRefund = await stripe.refunds.create({
    payment_intent: order.stripePaymentIntentId,
    amount: amountCents,
  });

  // Restocking is entirely driven by the explicit items list. The "no items
  // specified" default only applies to a plain full refund from a fresh
  // PAID/SHIPPED state (order.refunds.length === 0) — matching what this
  // function always did before partial refunds existed. Once any partial
  // refund has already happened, omitting items means "restock nothing this
  // time" (e.g. a goodwill top-up refund), never "restock everything again."
  // This keeps refundOrder as the SOLE place that ever restocks for a
  // refund; setOrderStatus below is used instead of updateOrderStatus
  // specifically so its blanket restock-on-REFUNDED branch never runs and
  // double-counts these units.
  const restockLines =
    input.items ?? (order.refunds.length === 0 ? order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })) : []);
  for (const line of restockLines) {
    const item = itemsById.get(line.orderItemId)!;
    await restockCommittedStock(
      item.variantId,
      line.quantity,
      { orderId: order.id, orderReference: order.reference },
      StockAdjustmentReason.REFUND_RESTOCK
    );
  }

  const newRefundedCents = order.refundedCents + amountCents;
  const nextStatus = newRefundedCents >= order.totalCents ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED;

  const createdRefund = await prisma.refundRecord.create({
    data: {
      orderId,
      amountCents,
      stripeRefundId: stripeRefund.id,
      items: { create: restockLines.map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity })) },
    },
  });
  await prisma.order.update({ where: { id: orderId }, data: { refundedCents: newRefundedCents } });

  await setOrderStatus(orderId, nextStatus);
  const updatedOrder = await getOrderById(orderId);
  return { order: updatedOrder, refundRecordId: createdRefund.id };
}
