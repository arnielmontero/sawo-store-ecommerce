import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requirePermission } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { listAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from "../services/adminUser.service";
import { listPermissionCatalog } from "../services/permission.service";

export const staffRouter = Router();

// Managing accounts — and, more importantly, their permission grants — is
// the privilege-escalation path this whole router exists to prevent, so it
// sits behind a single permission that only super-admins hold by default.
staffRouter.use(requireAuth, requirePermission("staff", "edit"));

// Registered before any "/:id"-shaped route so "permissions" is never
// parsed as an account id. Serves both the module/action catalog and the
// role presets, so the admin UI's checkbox grid never hardcodes either.
staffRouter.get("/permissions/catalog", async (_req, res, next) => {
  try {
    res.json(await listPermissionCatalog());
  } catch (err) {
    next(err);
  }
});

staffRouter.get("/", async (_req, res, next) => {
  try {
    const users = await listAdminUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

const permissionTokens = z.array(z.string().regex(/^[A-Za-z]+:[A-Za-z]+$/)).optional();

const createSchema = z.object({
  username: z.string().min(3).max(40),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  role: z.nativeEnum(AdminRole),
  permissions: permissionTokens,
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
  permissions: permissionTokens,
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
