import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";

export interface CartLine {
  variantId: number;
  quantity: number;
}

export interface PricedLine extends CartLine {
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface PricingResult {
  lines: PricedLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
}

// Never trust prices sent by the client — re-derive everything from the
// current variant price in the database. This is the only place order
// totals are computed; checkout must call this rather than accept a
// client-supplied total.
export async function priceCart(lines: CartLine[]): Promise<PricingResult> {
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

  // Discount codes, shipping-rate calculation, and tax (e.g. TaxJar/AvaTax)
  // are out of scope for now — no discount table, carrier-rate source, or
  // tax API account exists yet. Stubbed at 0 so the pipeline's shape is
  // correct end-to-end and each piece can be filled in independently later.
  const discountCents = 0;
  const shippingCents = 0;
  const taxCents = 0;

  return {
    lines: pricedLines,
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents - discountCents + shippingCents + taxCents,
  };
}
