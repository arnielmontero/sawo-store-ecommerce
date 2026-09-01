import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { deleteCarrierRule, listCarrierRules, upsertCarrierRule } from "../services/carrier.service";

export const carrierRulesRouter = Router();

carrierRulesRouter.use(requireAuth);

carrierRulesRouter.get("/", async (_req, res, next) => {
  try {
    const rules = await listCarrierRules();
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  country: z.string().length(2).toUpperCase(),
  carrier: z.string().min(1).max(40),
});

carrierRulesRouter.post("/", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const { country, carrier } = upsertSchema.parse(req.body);
    const rule = await upsertCarrierRule(country, carrier);
    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
});

carrierRulesRouter.delete("/:id", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await deleteCarrierRule(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
