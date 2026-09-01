import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import {
  listPendingShipments,
  listInTransitShipments,
  refreshAllDeliveryStatuses,
  shipOrder,
} from "../services/shipping.service";

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

// Live tracking view — refreshes every in-transit order's status from
// EasyPost before returning, so the page always shows current progress
// rather than what was last recorded on a previous visit.
shippingRouter.get("/in-transit", async (_req, res, next) => {
  try {
    const orders = await refreshAllDeliveryStatuses();
    res.json({ orders });
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
