import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { getCustomerById, listCustomers, updateCustomerProfile } from "../services/customer.service";
import { deleteCartLead, listCartLeadsForUser, logCartLead } from "../services/cartLead.service";
import { prisma } from "../lib/prisma";

export const customersRouter = Router();

customersRouter.use(requireAuth);

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  hasCartItems: z.coerce.boolean().optional(),
  hasFeedback: z.coerce.boolean().optional(),
});

customersRouter.get("/", async (req, res, next) => {
  try {
    const { page, search, hasCartItems, hasFeedback } = listQuerySchema.parse(req.query);
    const result = await listCustomers({ page, search, hasCartItems, hasFeedback });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const customer = await getCustomerById(id);
    if (!customer) throw new HttpError(404, "Customer not found");
    res.json({ customer });
  } catch (err) {
    next(err);
  }
});

const updateProfileSchema = z.object({
  name: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
});

customersRouter.patch("/:id", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = updateProfileSchema.parse(req.body);
    const customer = await updateCustomerProfile(id, input);
    res.json({ customer });
  } catch (err) {
    next(err);
  }
});

// ── Cart leads ─────────────────────────────────────────────────────────

const logCartLeadSchema = z.object({
  items: z.array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1),
  note: z.string().max(2000).optional(),
});

customersRouter.post(
  "/:id/cart-leads",
  requireRole(AdminRole.ADMIN, AdminRole.FULFILLMENT_STAFF),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      const { items, note } = logCartLeadSchema.parse(req.body);
      const admin = await prisma.adminUser.findUnique({ where: { id: req.adminAuth!.userId } });
      if (!admin) throw new HttpError(401, "Unauthorized");
      const lead = await logCartLead({ userId, items, note, loggedByName: admin.name });
      res.status(201).json({ cartLead: lead });
    } catch (err) {
      next(err);
    }
  }
);

customersRouter.get("/:id/cart-leads", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const cartLeads = await listCartLeadsForUser(userId);
    res.json({ cartLeads });
  } catch (err) {
    next(err);
  }
});

customersRouter.delete("/cart-leads/:leadId", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const leadId = Number(req.params.leadId);
    await deleteCartLead(leadId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
