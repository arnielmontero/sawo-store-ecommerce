import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import {
  listShipments,
  exportShipmentsCsv,
  getShipmentStatistics,
  refreshAllDeliveryStatuses,
  shipOrder,
} from "../services/shipping.service";

export const shippingRouter = Router();

shippingRouter.use(requireAuth, requireRole(AdminRole.ADMIN, AdminRole.FULFILLMENT_STAFF));

// carrier/country arrive as either a single string or an array depending on
// how many values are selected — standard Express query-parsing behavior
// for repeated ?carrier=X&carrier=Y params (mirrors payments.routes.ts's
// multi-select handling).
const toArraySchema = z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v : [v]));

const listQuerySchema = z.object({
  tab: z.enum(["pending", "in-transit", "history"]),
  search: z.string().optional(),
  carrier: toArraySchema.optional(),
  country: toArraySchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["createdAt", "paidAt", "updatedAt", "totalCents"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().positive().optional(),
});

// Registered before "/:orderId"-shaped routes so "export"/"statistics"
// never get parsed as an order id — same precaution as orders.routes.ts.
shippingRouter.get("/", async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query);
    // Live refresh from EasyPost only applies to the in-transit tab — the
    // other two tabs have no upstream tracker status to re-poll, matching
    // today's GET /in-transit-only refresh behavior.
    if (q.tab === "in-transit") await refreshAllDeliveryStatuses();
    const result = await listShipments(q.tab, {
      search: q.search,
      carrier: q.carrier,
      country: q.country,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      sortBy: q.sortBy,
      sortDir: q.sortDir,
      page: q.page,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Exports the same filtered set the on-screen tab would show (minus
// pagination) — reuses listQuerySchema so search/carrier/country/date
// filters behave identically between the list and its export.
shippingRouter.get("/export", async (req, res, next) => {
  try {
    const q = listQuerySchema.omit({ page: true }).parse(req.query);
    const csv = await exportShipmentsCsv(q.tab, {
      search: q.search,
      carrier: q.carrier,
      country: q.country,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="deliveries-${q.tab}-export.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

shippingRouter.get("/statistics", async (_req, res, next) => {
  try {
    const stats = await getShipmentStatistics();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

const shipSchema = z.object({ trackingNumber: z.string().min(1), carrier: z.string().min(1).optional() });

shippingRouter.patch("/:orderId/ship", async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const { trackingNumber, carrier } = shipSchema.parse(req.body);
    const order = await shipOrder(orderId, trackingNumber, carrier);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
