import { Router } from "express";
import { z } from "zod";
import { AdminRole, CouponType } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { checkoutRateLimiter } from "../middleware/rateLimit";
import { priceCart } from "../services/pricing.service";
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from "../services/coupon.service";

export const couponsRouter = Router();

const validateSchema = z.object({
  code: z.string().min(1).max(30),
  items: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        quantity: z.number().int().positive().max(50),
      })
    )
    .min(1),
  // Optional — lets the storefront's preview reflect the real tax the
  // customer will pay (see taxRule.service.ts) instead of always showing
  // $0 tax until the order is actually placed. Omitted entirely still
  // works fine (taxCents just comes back 0), so this stays backward
  // compatible with any caller that only cares about the discount.
  shippingCountry: z.string().length(2).toUpperCase().optional(),
});

// "Customer" access per the design — same unauthenticated + rate-limited
// tradeoff as POST /orders/checkout (see orders.routes.ts). Lets the
// storefront preview a coupon's effect (and, if a shippingCountry is given,
// tax) before submitting a real order, without consuming a use — priceCart
// itself never increments usageCount.
couponsRouter.post("/validate", checkoutRateLimiter, async (req, res, next) => {
  try {
    const { code, items, shippingCountry } = validateSchema.parse(req.body);
    const pricing = await priceCart(items, code, shippingCountry);
    res.json({
      discountCents: pricing.discountCents,
      shippingCents: pricing.shippingCents,
      taxCents: pricing.taxCents,
      totalCents: pricing.totalCents,
      appliedCoupon: pricing.appliedCoupon,
    });
  } catch (err) {
    next(err);
  }
});

// Everything below is backoffice-only.
couponsRouter.use(requireAuth);

couponsRouter.get("/", async (_req, res, next) => {
  try {
    const coupons = await listCoupons();
    res.json({ coupons });
  } catch (err) {
    next(err);
  }
});

const couponSchema = z
  .object({
    code: z.string().min(3).max(30),
    type: z.nativeEnum(CouponType),
    value: z.number().int().optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    maxUses: z.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      if (data.type === CouponType.PERCENTAGE) return data.value != null && data.value >= 1 && data.value <= 100;
      if (data.type === CouponType.FIXED_AMOUNT) return data.value != null && data.value > 0;
      if (data.type === CouponType.FREE_SHIPPING) return data.value == null;
      return true;
    },
    { message: "value must match the coupon type's rules", path: ["value"] }
  );

couponsRouter.post("/", requireRole(AdminRole.ADMIN, AdminRole.MANAGER), async (req, res, next) => {
  try {
    const input = couponSchema.parse(req.body);
    const coupon = await createCoupon(input);
    res.status(201).json({ coupon });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  type: z.nativeEnum(CouponType).optional(),
  value: z.number().int().nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

couponsRouter.patch("/:id", requireRole(AdminRole.ADMIN, AdminRole.MANAGER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = updateSchema.parse(req.body);
    const coupon = await updateCoupon(id, input);
    res.json({ coupon });
  } catch (err) {
    next(err);
  }
});

couponsRouter.delete("/:id", requireRole(AdminRole.ADMIN, AdminRole.MANAGER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await deleteCoupon(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
