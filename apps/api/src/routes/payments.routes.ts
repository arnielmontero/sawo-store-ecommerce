import { Router } from "express";
import { z } from "zod";
import { OrderStatus, PaymentMethod } from "@prisma/client";
import { requireAuth, requirePermission } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { getStripeWebhookSecret } from "../lib/credentials";
import {
  createPaymentIntent,
  exportPaymentsXlsx,
  handleStripeWebhook,
  listPayments,
  refundOrder,
} from "../services/payment.service";

export const paymentsRouter = Router();

// Checkbox dropdowns in the admin UI send repeated query params for a
// multi-select (?paymentMethod=CARD&paymentMethod=BANK) — coerce a single
// value into a one-element array so both cases parse the same way.
const toArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === undefined ? undefined : Array.isArray(val) ? val : [val]), z.array(schema)).optional();

const listQuerySchema = z
  .object({
    search: z.string().optional(),
    paymentMethod: toArray(z.nativeEnum(PaymentMethod)),
    status: toArray(z.nativeEnum(OrderStatus)),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.enum(["createdAt", "totalCents", "paymentAttemptCount"]).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
  })
  // Rejects an inverted range outright rather than silently matching zero
  // rows — same guard as orders.routes.ts/shipping.routes.ts.
  .refine((q) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, {
    message: "dateFrom must not be after dateTo",
    path: ["dateFrom"],
  });

// Admin only — list of orders that have gone through payment processing.
paymentsRouter.get("/", requireAuth, requirePermission("payments", "view"), async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query);
    const result = await listPayments(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Exports the same filtered set the on-screen list would show (minus
// pagination) — reuses listQuerySchema so search/method/status/date filters
// behave identically between the list and its export.
paymentsRouter.get(
  "/export",
  requireAuth,
  requirePermission("payments", "view"),
  async (req, res, next) => {
    try {
      const filters = listQuerySchema.parse(req.query);
      const buffer = await exportPaymentsXlsx(filters);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="payments-export.xlsx"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

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

    const webhookSecret = await getStripeWebhookSecret();
    if (!webhookSecret) throw new HttpError(503, "Stripe webhook secret isn't configured yet.");

    await handleStripeWebhook(req.body, signature, webhookSecret);
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

const refundSchema = z.object({
  orderId: z.number().int().positive(),
  // Omitted = refund the full remaining balance (the original behavior).
  // Providing less than the full remaining balance requires
  // StoreSettings.allowPartialRefunds to be on — enforced in refundOrder.
  amountCents: z.number().int().positive().optional(),
  // Which order items/quantities to restock as a result of this refund.
  // Omitted = for a full refund, every item's full quantity is restocked
  // (the original behavior); for a partial refund, nothing is restocked
  // unless explicitly listed here.
  items: z
    .array(z.object({ orderItemId: z.number().int().positive(), quantity: z.number().int().positive() }))
    .optional(),
});

// Admin only — matches the diagram ("Admin: Initiates full or partial
// refunds").
paymentsRouter.post("/refund", requireAuth, requirePermission("orders", "refund"), async (req, res, next) => {
  try {
    const { orderId, amountCents, items } = refundSchema.parse(req.body);
    const { order } = await refundOrder(orderId, { amountCents, items });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
