import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { listAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from "../services/adminUser.service";

export const staffRouter = Router();

// Staff management is ADMIN-only end to end — a FULFILLMENT_STAFF account
// managing other accounts (including granting itself ADMIN) is exactly the
// privilege-escalation path this whole router exists to prevent.
staffRouter.use(requireAuth, requireRole(AdminRole.ADMIN));

staffRouter.get("/", async (_req, res, next) => {
  try {
    const users = await listAdminUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  username: z.string().min(3).max(40),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  role: z.nativeEnum(AdminRole),
});

staffRouter.post("/", async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const user = await createAdminUser(input);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.nativeEnum(AdminRole).optional(),
  password: z.string().min(8).optional(),
});

staffRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = updateSchema.parse(req.body);
    const user = await updateAdminUser(id, input);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

staffRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!req.adminAuth) throw new HttpError(401, "Unauthorized");
    await deleteAdminUser(id, req.adminAuth.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
