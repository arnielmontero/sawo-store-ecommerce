import { CouponType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { getTaxRateForCountry } from "./taxRule.service";
import { getShippingQuote } from "../lib/shippingQuote";

export interface CartLine {
  variantId: number;
  quantity: number;
}

export interface PricedLine extends CartLine {
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface AppliedCoupon {
  id: number;
  code: string;
  type: CouponType;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  // Both null/false when shipping is $0 for any reason (no country known,
  // FREE_SHIPPING coupon, ShipStation not active, or a quote fallback —
  // see lib/shippingQuote.ts) — not just when a real quote succeeded.
  shippingServiceName: string | null;
  isShippingEstimate: boolean;
  taxCents: number;
  totalCents: number;
  appliedCoupon: AppliedCoupon | null;
}

export interface ShippingAddressInput {
  street1: string;
  city: string;
  state: string;
  postalCode: string;
}

// Looks up and validates a coupon code, throwing a clear 4xx for any reason
// it can't be applied rather than silently no-op'ing a bad code into a $0
// discount that would look like success to the caller.
async function resolveCoupon(code: string) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) throw new HttpError(400, "Invalid coupon code");
  if (!coupon.isActive) throw new HttpError(400, "This coupon is no longer active");

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    throw new HttpError(400, "This coupon is not yet valid");
  }
  if (coupon.endsAt && now > coupon.endsAt) {
    throw new HttpError(400, "This coupon has expired");
  }
  if (coupon.maxUses != null && coupon.usageCount >= coupon.maxUses) {
    throw new HttpError(400, "This coupon has reached its usage limit");
  }

  return coupon;
}

// Never trust prices sent by the client — re-derive everything from the
// current variant price in the database. This is the only place order
// totals are computed; checkout must call this rather than accept a
// client-supplied total.
//
// couponCode is optional and, when provided, is fully validated here
// (active, within its date window, under maxUses) — see resolveCoupon. This
// function does NOT increment the coupon's usageCount: it's also called by
// the validate-only preview endpoint, which must not consume a use just by
// previewing. Only order.service.ts's checkout() increments usage, inside a
// transaction alongside order creation.
//
// shippingCountry drives the tax rate (see taxRule.service.ts) the same way
// it already drives carrier assignment and payment-method restrictions —
// one more thing keyed off the same field rather than a separate "tax
// country" concept. It also now drives a real shipping-cost quote (see
// lib/shippingQuote.ts) — shippingAddress, when passed, gets the fully
// accurate quote for that exact address; when omitted (shippingCountry
// known but no full address yet), a representative-city estimate is used
// instead. When shippingCountry itself is omitted, shipping stays $0,
// exactly as before this was wired up.
export async function priceCart(
  lines: CartLine[],
  couponCode?: string,
  shippingCountry?: string | null,
  shippingAddress?: ShippingAddressInput
): Promise<PricingResult> {
  if (lines.length === 0) throw new HttpError(400, "Cart must contain at least one item");

  const variantIds = lines.map((line) => line.variantId);
  const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds } } });
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const pricedLines: PricedLine[] = lines.map((line) => {
    const variant = variantById.get(line.variantId);
    if (!variant) throw new HttpError(400, `Unknown product variant: ${line.variantId}`);
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      unitPriceCents: variant.priceCents,
      lineTotalCents: variant.priceCents * line.quantity,
    };
  });

  const subtotalCents = pricedLines.reduce((sum, line) => sum + line.lineTotalCents, 0);

  let shippingCents = 0;
  let shippingServiceName: string | null = null;
  let isShippingEstimate = false;
  if (shippingCountry) {
    const quote = await getShippingQuote({ items: lines, shippingCountry, address: shippingAddress });
    shippingCents = quote.shippingCents;
    shippingServiceName = quote.serviceName;
    isShippingEstimate = quote.isEstimate;
  }

  let discountCents = 0;
  let appliedCoupon: AppliedCoupon | null = null;

  if (couponCode) {
    const coupon = await resolveCoupon(couponCode);

    if (coupon.type === CouponType.PERCENTAGE) {
      discountCents = Math.round(subtotalCents * ((coupon.value ?? 0) / 100));
    } else if (coupon.type === CouponType.FIXED_AMOUNT) {
      // Capped at the subtotal so a fixed coupon can never push the
      // discount past the order's own merchandise value.
      discountCents = Math.min(coupon.value ?? 0, subtotalCents);
    } else if (coupon.type === CouponType.FREE_SHIPPING) {
      shippingCents = 0;
      shippingServiceName = null;
      isShippingEstimate = false;
    }

    appliedCoupon = { id: coupon.id, code: coupon.code, type: coupon.type };
  }

  // Tax is computed on the discounted subtotal (subtotal minus the coupon
  // discount, before shipping is added back in) — the standard order of
  // operations, and the one that makes "discount this order" and "tax this
  // order" never fight over which one sees the other's effect.
  const taxRate = await getTaxRateForCountry(shippingCountry);
  const taxableAmountCents = Math.max(0, subtotalCents - discountCents);
  const taxCents = Math.round(taxableAmountCents * (taxRate / 100));

  return {
    lines: pricedLines,
    subtotalCents,
    discountCents,
    shippingCents,
    shippingServiceName,
    isShippingEstimate,
    taxCents,
    totalCents: subtotalCents - discountCents + shippingCents + taxCents,
    appliedCoupon,
  };
}
