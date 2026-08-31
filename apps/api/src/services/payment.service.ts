import Stripe from "stripe";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { HttpError } from "../middleware/errorHandler";
import { updateOrderStatus } from "./order.service";

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

// Verifies the webhook's Stripe signature (proves the request really came
// from Stripe, not a forged "payment succeeded" call from anyone who finds
// the endpoint), then checks the event.id against ProcessedWebhookEvent
// before doing anything — Stripe redelivers events on any ambiguous
// response, so the same event.id can arrive more than once.
export async function handleStripeWebhook(rawBody: Buffer, signature: string, webhookSecret: string) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    throw new HttpError(400, "Invalid webhook signature");
  }

  const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({ where: { id: event.id } });
  if (alreadyProcessed) return;

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = Number(intent.metadata.orderId);
    if (orderId) {
      await updateOrderStatus(orderId, OrderStatus.PAID);
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = Number(intent.metadata.orderId);
    if (orderId) {
      await updateOrderStatus(orderId, OrderStatus.CANCELLED);
    }
  }

  // Recorded last, after the side-effect succeeds — if updateOrderStatus
  // throws, the event is NOT marked processed, so Stripe's retry can still
  // succeed on a later delivery instead of being silently swallowed.
  await prisma.processedWebhookEvent.create({ data: { id: event.id, type: event.type } });
}

// Admin payments view — orders that have actually gone through payment
// processing (a PaymentIntent was created), so PENDING orders that never
// got as far as checkout's payment step don't clutter the list.
export async function listPayments() {
  return prisma.order.findMany({
    where: { stripePaymentIntentId: { not: null } },
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
    orderBy: { createdAt: "desc" },
  });
}

export async function refundOrder(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status !== OrderStatus.PAID) {
    throw new HttpError(409, `Cannot refund an order in status ${order.status}`);
  }
  if (!order.stripePaymentIntentId) {
    throw new HttpError(409, "Order has no associated payment to refund");
  }

  await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });

  return updateOrderStatus(orderId, OrderStatus.REFUNDED);
}
