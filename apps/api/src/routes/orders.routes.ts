import { Router } from "express";
import { z } from "zod";
import { OrderStatus, PaymentMethod, AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { checkoutRateLimiter } from "../middleware/rateLimit";
import { HttpError } from "../middleware/errorHandler";
import { checkout, getOrderById, getOrdersForUser, listOrders, updateOrderStatus } from "../services/order.service";

export const ordersRouter = Router();

const checkoutSchema = z.object({
  userId: z.number().int().positive().optional(),
  items: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        quantity: z.number().int().positive().max(50),
      })
    )
    .min(1),
  paymentMethod: z.nativeEnum(PaymentMethod),
  shippingAddress: z.string().optional(),
});

// "Customer" access per the design — no customer auth system exists yet
// (admin-panel-only scope so far), so this is left unauthenticated and
// rate-limited, same tradeoff as /inventory/reserve.
ordersRouter.post("/checkout", checkoutRateLimiter, async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);
    const order = await checkout(input);
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

const meQuerySchema = z.object({ userId: z.coerce.number().int().positive() });

// "Customer" access per the design. There's no customer session to read
// "the logged-in user" from yet, so userId is accepted as an explicit query
// param — NOT secure (anyone can pass any userId) and only a stand-in until
// real customer auth exists.
ordersRouter.get("/me", async (req, res, next) => {
  try {
    const { userId } = meQuerySchema.parse(req.query);
    const orders = await getOrdersForUser(userId);
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// Everything below is backoffice-only.
ordersRouter.use(requireAuth);

ordersRouter.get("/", async (_req, res, next) => {
  try {
    const orders = await listOrders();
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

ordersRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const order = await getOrderById(id);
    if (!order) throw new HttpError(404, "Order not found");
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

const updateStatusSchema = z.object({ status: z.nativeEnum(OrderStatus) });

// Admin or Fulfillment Staff — matches the diagram ("Staff: transitions the
// order state, e.g. PAID -> SHIPPED"). The state machine itself (see
// lib/orderStateMachine.ts) rejects any transition that isn't a valid next
// step, regardless of role.
ordersRouter.patch(
  "/:id/status",
  requireRole(AdminRole.ADMIN, AdminRole.FULFILLMENT_STAFF),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const { status } = updateStatusSchema.parse(req.body);
      const order = await updateOrderStatus(id, status);
      if (!order) throw new HttpError(404, "Order not found");
      res.json({ order });
    } catch (err) {
      next(err);
    }
  }
);
