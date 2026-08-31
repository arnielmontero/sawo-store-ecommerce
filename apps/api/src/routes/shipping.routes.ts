import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { listPendingShipments, shipOrder } from "../services/shipping.service";

export const shippingRouter = Router();

shippingRouter.use(requireAuth, requireRole(AdminRole.ADMIN, AdminRole.FULFILLMENT_STAFF));

shippingRouter.get("/pending", async (_req, res, next) => {
  try {
    const orders = await listPendingShipments();
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

const shipSchema = z.object({ trackingNumber: z.string().min(1) });

shippingRouter.patch("/:orderId/ship", async (req, res, next) => {
  try {
    const orderId = Number(req.params.orderId);
    const { trackingNumber } = shipSchema.parse(req.body);
    const order = await shipOrder(orderId, trackingNumber);
    res.json({ order });
  } catch (err) {
    next(err);
  }
});
