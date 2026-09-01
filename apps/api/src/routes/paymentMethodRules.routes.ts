import { Router } from "express";
import { z } from "zod";
import { AdminRole, PaymentMethod } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { listPaymentMethodRules, setPaymentMethodRules } from "../services/paymentMethodRule.service";

export const paymentMethodRulesRouter = Router();

paymentMethodRulesRouter.use(requireAuth);

paymentMethodRulesRouter.get("/", async (_req, res, next) => {
  try {
    const rules = await listPaymentMethodRules();
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});

const setSchema = z.object({
  country: z.string().length(2).toUpperCase(),
  methods: z.array(z.nativeEnum(PaymentMethod)),
});

// Replaces the full set of allowed methods for a country — passing an empty
// array clears the rule entirely (back to "no restriction" for that
// country, see paymentMethodRule.service.ts's isPaymentMethodAllowed).
paymentMethodRulesRouter.put("/:country", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const { country, methods } = setSchema.parse({ ...req.body, country: req.params.country });
    const rules = await setPaymentMethodRules(country, methods);
    res.json({ rules });
  } catch (err) {
    next(err);
  }
});
