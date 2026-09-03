import { Router } from "express";
import { z } from "zod";
import { OrderStatus, PaymentMethod, AdminRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { checkoutRateLimiter } from "../middleware/rateLimit";
import { HttpError } from "../middleware/errorHandler";
import {
  addOrderNote,
  checkout,
  exportOrdersXlsx,
  getOrderById,
  getOrdersForUser,
  getOrderStatistics,
  getTopProducts,
  listHeldOrders,
  listOrders,
  updateOrderStatus,
} from "../services/order.service";
import { approveReturnRequest, logReturnRequest, rejectReturnRequest } from "../services/returnRequest.service";
import { getStoreSettings } from "../services/settings.service";
import { buildInvoicePdf } from "../lib/invoicePdf";

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
  shippingCountry: z.string().length(2).toUpperCase().optional(),
  couponCode: z.string().min(1).max(30).optional(),
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

const listQuerySchema = z
  .object({
    search: z.string().optional(),
    status: z.nativeEnum(OrderStatus).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    page: z.coerce.number().int().positive().optional(),
  })
  // Rejects an inverted range outright rather than silently matching zero
  // rows (gte dateFrom AND lte dateTo can never both hold when
  // dateFrom > dateTo) — the date pickers already prevent this in the UI
  // via min/max, this is the backstop for any other caller.
  .refine((q) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo, {
    message: "dateFrom must not be after dateTo",
    path: ["dateFrom"],
  });

ordersRouter.get("/", async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query);
    const result = await listOrders(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Registered before "/:id" so "statistics"/"held" never get parsed as an
// order id.
ordersRouter.get("/statistics", async (_req, res, next) => {
  try {
    const stats = await getOrderStatistics();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

ordersRouter.get("/top-products", async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const products = await getTopProducts(limit);
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

ordersRouter.get("/held", async (_req, res, next) => {
  try {
    const orders = await listHeldOrders();
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// Exports the same filtered set the on-screen list would show (minus
// pagination) — reuses listQuerySchema so search/status/date-range filters
// behave identically between the list and its export.
ordersRouter.get("/export", async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query);
    const buffer = await exportOrdersXlsx(filters);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="orders-export.xlsx"`);
    res.send(buffer);
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

ordersRouter.get("/:id/invoice", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const order = await getOrderById(id);
    if (!order) throw new HttpError(404, "Order not found");
    const settings = await getStoreSettings();
    const buffer = await buildInvoicePdf(order, settings.storeName);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.reference}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

const addNoteSchema = z.object({ body: z.string().min(1).max(2000) });

// Any authenticated backoffice user can leave a note — unlike status
// transitions, this isn't a role-gated action, just a record of who said
// what and when.
ordersRouter.post("/:id/notes", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { body } = addNoteSchema.parse(req.body);
    const admin = await prisma.adminUser.findUnique({ where: { id: req.adminAuth!.userId } });
    if (!admin) throw new HttpError(401, "Unauthorized");
    const order = await addOrderNote(id, body, admin.name);
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

const logReturnRequestSchema = z.object({
  reason: z.string().min(1).max(2000),
  items: z
    .array(z.object({ orderItemId: z.number().int().positive(), quantity: z.number().int().positive() }))
    .min(1),
});

// Admin or Fulfillment Staff can log what a customer asked for (there's no
// live customer session yet — see checkout()), same reasoning as order
// notes/status transitions: this just records what was relayed, it doesn't
// move money on its own.
ordersRouter.post(
  "/:id/return-requests",
  requireRole(AdminRole.ADMIN, AdminRole.MANAGER, AdminRole.FULFILLMENT_STAFF),
  async (req, res, next) => {
    try {
      const orderId = Number(req.params.id);
      const { reason, items } = logReturnRequestSchema.parse(req.body);
      const admin = await prisma.adminUser.findUnique({ where: { id: req.adminAuth!.userId } });
      if (!admin) throw new HttpError(401, "Unauthorized");
      const order = await logReturnRequest({ orderId, reason, items, loggedByName: admin.name });
      res.status(201).json({ order });
    } catch (err) {
      next(err);
    }
  }
);

const approveReturnRequestSchema = z.object({
  amountCents: z.number().int().positive().optional(),
  reviewNote: z.string().max(2000).optional(),
});

// ADMIN-only — this is the step that actually moves money (via the same
// refundOrder() a plain refund uses), held to the same bar as the existing
// refund endpoint.
ordersRouter.post(
  "/return-requests/:requestId/approve",
  requireRole(AdminRole.ADMIN, AdminRole.MANAGER),
  async (req, res, next) => {
    try {
      const requestId = Number(req.params.requestId);
      const { amountCents, reviewNote } = approveReturnRequestSchema.parse(req.body);
      const admin = await prisma.adminUser.findUnique({ where: { id: req.adminAuth!.userId } });
      if (!admin) throw new HttpError(401, "Unauthorized");
      const order = await approveReturnRequest(requestId, { amountCents, reviewNote, resolvedByName: admin.name });
      res.json({ order });
    } catch (err) {
      next(err);
    }
  }
);

const rejectReturnRequestSchema = z.object({ reviewNote: z.string().max(2000).optional() });

ordersRouter.post(
  "/return-requests/:requestId/reject",
  requireRole(AdminRole.ADMIN, AdminRole.MANAGER),
  async (req, res, next) => {
    try {
      const requestId = Number(req.params.requestId);
      const { reviewNote } = rejectReturnRequestSchema.parse(req.body);
      const admin = await prisma.adminUser.findUnique({ where: { id: req.adminAuth!.userId } });
      if (!admin) throw new HttpError(401, "Unauthorized");
      const order = await rejectReturnRequest(requestId, reviewNote ?? "", admin.name);
      res.json({ order });
    } catch (err) {
      next(err);
    }
  }
);

const updateStatusSchema = z.object({ status: z.nativeEnum(OrderStatus) });

// Admin or Fulfillment Staff — matches the diagram ("Staff: transitions the
// order state, e.g. PAID -> SHIPPED"). The state machine itself (see
// lib/orderStateMachine.ts) rejects any transition that isn't a valid next
// step, regardless of role.
ordersRouter.patch(
  "/:id/status",
  requireRole(AdminRole.ADMIN, AdminRole.MANAGER, AdminRole.FULFILLMENT_STAFF),
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
