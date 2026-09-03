import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../middleware/requireAuth";
import { deleteTaxRule, listTaxRules, upsertTaxRule } from "../services/taxRule.service";

export const taxRulesRouter = Router();

taxRulesRouter.use(requireAuth);

taxRulesRouter.get("/", async (_req, res, next) => {
  try {
    const rules = await listTaxRules();
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  country: z.string().length(2).toUpperCase(),
  ratePercent: z.number().min(0).max(100),
});

taxRulesRouter.post("/", requirePermission("taxRules", "create"), async (req, res, next) => {
  try {
    const { country, ratePercent } = upsertSchema.parse(req.body);
    const rule = await upsertTaxRule(country, ratePercent);
    res.status(201).json({ rule });
  } catch (err) {
    next(err);
  }
});

taxRulesRouter.delete("/:id", requirePermission("taxRules", "delete"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await deleteTaxRule(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
