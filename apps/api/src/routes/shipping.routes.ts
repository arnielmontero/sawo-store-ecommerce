import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../middleware/requireAuth";
import {
  listShipments,
  exportShipmentsXlsx,
  getShipmentStatistics,
  refreshAllDeliveryStatuses,
  shipOrder,
  previewLabelAddress,
  getLabelQuote,
  buyShipEngineLabel,
} from "../services/shipping.service";

export const shippingRouter = Router();

shippingRouter.use(requireAuth);

// carrier/country arrive as either a single string or an array depending on
// how many values are selected — standard Express query-parsing behavior
// for repeated ?carrier=X&carrier=Y params (mirrors payments.routes.ts's
// multi-select handling).
const toArraySchema = z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v : [v]));

const listQueryBaseSchema = z.object({
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

// Rejects an inverted range outright rather than silently matching zero
// rows (gte dateFrom AND lte dateTo can never both hold when
// dateFrom > dateTo) — the date pickers already prevent this in the UI via
// min/max, this is the backstop for any other caller. Applied to both the
// list and export schemas below (export first .omit()s page, which needs
// the base object shape, so the refine is layered on after).
const dateRangeRefinement = (q: { dateFrom?: string; dateTo?: string }) => !q.dateFrom || !q.dateTo || q.dateFrom <= q.dateTo;
const dateRangeIssue = { message: "dateFrom must not be after dateTo", path: ["dateFrom"] };

const listQuerySchema = listQueryBaseSchema.refine(dateRangeRefinement, dateRangeIssue);

// Registered before "/:orderId"-shaped routes so "export"/"statistics"
// never get parsed as an order id — same precaution as orders.routes.ts.
shippingRouter.get("/", requirePermission("deliveries", "view"), async (req, res, next) => {
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
shippingRouter.get("/export", requirePermission("deliveries", "view"), async (req, res, next) => {
  try {
    const q = listQueryBaseSchema.omit({ page: true }).refine(dateRangeRefinement, dateRangeIssue).parse(req.query);
    const buffer = await exportShipmentsXlsx(q.tab, {
      search: q.search,
      carrier: q.carrier,
      country: q.country,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="deliveries-${q.tab}-export.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

shippingRouter.get("/statistics", requirePermission("deliveries", "view"), async (_req, res, next) => {
  try {
    const stats = await getShipmentStatistics();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

const shipSchema = z.object({ trackingNumber: z.string().min(1), carrier: z.string().min(1).optional() });

shippingRouter.patch("/:orderId/ship", requirePermission("deliveries", "manage"), async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const { trackingNumber, carrier } = shipSchema.parse(req.body);
    const order = await shipOrder(orderId, trackingNumber, carrier);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// No side effects, no ShipEngine call — lets the admin review the
// best-effort parsed address before any label is purchased. See
// previewLabelAddress in shipping.service.ts.
shippingRouter.get("/:orderId/label-preview", requirePermission("deliveries", "manage"), async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const preview = await previewLabelAddress(orderId);
    res.json(preview);
  } catch (err) {
    next(err);
  }
});

const buyLabelSchema = z.object({
  carrier: z.string().min(1).optional(),
  address: z
    .object({
      street1: z.string().min(1),
      street2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().min(1),
      postalCode: z.string().min(1),
    })
    .optional(), // present when the admin edited the parsed fields; absent = trust the auto-parse
});

// Real price quote — no purchase, no cost, safe to call as the admin edits
// the review panel. See getLabelQuote in shipping.service.ts. Lets
// "Confirm purchase" be an informed decision instead of a blind one.
shippingRouter.post("/:orderId/label-quote", requirePermission("deliveries", "manage"), async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const { carrier, address } = buyLabelSchema.parse(req.body);
    const quote = await getLabelQuote(orderId, carrier, address);
    res.json(quote);
  } catch (err) {
    next(err);
  }
});

// Buys a real ShipEngine label — costs real money on a live account. See
// buyShipEngineLabel in shipping.service.ts for the full flow (weight sum,
// ship-from validation, label download, order finalization).
shippingRouter.post("/:orderId/buy-label", requirePermission("deliveries", "manage"), async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const { carrier, address } = buyLabelSchema.parse(req.body);
    const order = await buyShipEngineLabel(orderId, carrier, address);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
