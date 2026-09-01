import { Router } from "express";
import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { requireAuth } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import {
  checkForStaleOrders,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification.service";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

const listQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  includeResolved: z.coerce.boolean().optional(),
  type: z.nativeEnum(NotificationType).optional(),
  page: z.coerce.number().int().positive().optional(),
});

// ORDER_STALE has no single event that creates it (see notification.service
// .ts) — it's swept for live on every read of the inbox instead, cheap
// since it only ever scans orders already in PENDING/SHIPPED.
notificationsRouter.get("/", async (req, res, next) => {
  try {
    const { unreadOnly, includeResolved, type, page } = listQuerySchema.parse(req.query);
    await checkForStaleOrders();
    const result = await listNotifications({ unreadOnly, includeResolved, type, page });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/:id/read", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "Invalid notification id");
    await markNotificationRead(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/read-all", async (_req, res, next) => {
  try {
    await markAllNotificationsRead();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
