import { Router } from "express";
import { z } from "zod";
import { reserveRateLimiter } from "../middleware/rateLimit";
import { HttpError } from "../middleware/errorHandler";
import { reserveStock } from "../services/inventory.service";

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
