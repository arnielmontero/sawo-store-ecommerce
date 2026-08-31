import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { env } from "../lib/env";
import { createPaymentIntent, handleStripeWebhook, listPayments, refundOrder } from "../services/payment.service";

export const paymentsRouter = Router();

// Admin only — list of orders that have gone through payment processing.
paymentsRouter.get("/", requireAuth, requireRole(AdminRole.ADMIN, AdminRole.FULFILLMENT_STAFF), async (_req, res, next) => {
  try {
    const payments = await listPayments();
    res.json({ payments });
  } catch (err) {
    next(err);
  }
});

const intentSchema = z.object({ orderId: z.number().int().positive() });

// "Customer" access per the design — no customer auth system exists yet,
// same tradeoff already made for /orders/checkout and /inventory/reserve.
paymentsRouter.post("/intent", async (req, res, next) => {
  try {
    const { orderId } = intentSchema.parse(req.body);
    const result = await createPaymentIntent(orderId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Gateway access — authenticated by Stripe's webhook signature (verified
// inside handleStripeWebhook), not by our own auth system. Requires the
// RAW request body, so this route is registered before express.json() in
// index.ts using express.raw() scoped to just this path.
paymentsRouter.post("/webhook", async (req, res, next) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") throw new HttpError(400, "Missing Stripe signature header");
    if (!Buffer.isBuffer(req.body)) throw new HttpError(400, "Expected raw request body");

    await handleStripeWebhook(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

const refundSchema = z.object({ orderId: z.number().int().positive() });

// Admin only — matches the diagram ("Admin: Initiates full or partial
// refunds"). Full refunds only for now; partial-amount refunds would need
// an amount field and matching partial-inventory-restock logic.
paymentsRouter.post("/refund", requireAuth, requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const { orderId } = refundSchema.parse(req.body);
    const order = await refundOrder(orderId);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
