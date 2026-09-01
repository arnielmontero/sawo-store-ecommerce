import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { reserveRateLimiter } from "../middleware/rateLimit";
import { HttpError } from "../middleware/errorHandler";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import {
  adjustStockManually,
  getInventorySummary,
  getStockAdjustmentHistory,
  listInventory,
  reserveStock,
} from "../services/inventory.service";

export const inventoryRouter = Router();

const reserveSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().positive().max(50),
});

// Unauthenticated — there's no customer login system yet (admin-panel-only
// scope so far), so this is left open as the endpoint a future storefront
// checkout would call. Rate-limited as the only current abuse guard.
inventoryRouter.post("/reserve", reserveRateLimiter, async (req, res, next) => {
  try {
    const { variantId, quantity } = reserveSchema.parse(req.body);
    const reserved = await reserveStock(variantId, quantity);
    if (!reserved) throw new HttpError(409, "Not enough stock available");
    res.json({ reserved: true });
  } catch (err) {
    next(err);
  }
});

// Everything below is the Inventory admin page — backoffice-only.
const adminRouter = Router();
inventoryRouter.use("/admin", requireAuth, adminRouter);

const listQuerySchema = z.object({
  search: z.string().optional(),
  stockFilter: z.enum(["low", "out"]).optional(),
  page: z.coerce.number().int().positive().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

adminRouter.get("/", async (req, res, next) => {
  try {
    const filters = listQuerySchema.parse(req.query);
    const result = await listInventory(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/summary", async (_req, res, next) => {
  try {
    const summary = await getInventorySummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/:variantId/history", async (req, res, next) => {
  try {
    const variantId = Number(req.params.variantId);
    const page = req.query.page ? Number(req.query.page) : undefined;
    const result = await getStockAdjustmentHistory(variantId, page);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const adjustSchema = z.object({
  stockQuantity: z.number().int().nonnegative(),
  note: z.string().min(1).max(500),
});

// ADMIN-only, unlike the quick inline stock field on a product's Catalog
// page (ADMIN + FULFILLMENT_STAFF) — this is the dedicated adjustment
// screen and always requires a stated reason, so it's held to the same bar
// as other ADMIN-only catalog writes.
adminRouter.patch("/:variantId/adjust", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const variantId = Number(req.params.variantId);
    const { stockQuantity, note } = adjustSchema.parse(req.body);
    const admin = await prisma.adminUser.findUnique({ where: { id: req.adminAuth!.userId } });
    if (!admin) throw new HttpError(401, "Unauthorized");
    await adjustStockManually(variantId, stockQuantity, admin.name, note);
    const inventory = await prisma.inventory.findUnique({ where: { variantId } });
    if (!inventory) throw new HttpError(404, "Variant not found");
    res.json({ inventory });
  } catch (err) {
    next(err);
  }
});
