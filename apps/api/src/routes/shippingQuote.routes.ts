import { Router } from "express";
import { z } from "zod";
import { checkoutRateLimiter } from "../middleware/rateLimit";
import { getShippingQuote } from "../lib/shippingQuote";

export const shippingQuoteRouter = Router();

const shippingQuoteSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        quantity: z.number().int().positive().max(50),
      })
    )
    .min(1),
  shippingCountry: z.string().length(2).toUpperCase(),
  // Full address — when present, the quote reflects the exact destination
  // instead of the country-level representative-city estimate. See
  // lib/shippingQuote.ts.
  address: z
    .object({
      street1: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      postalCode: z.string().min(1),
    })
    .optional(),
});

// "Customer" access — unauthenticated + rate-limited, same tradeoff as
// POST /orders/checkout and POST /coupons/validate. Never throws a real
// error to the caller: getShippingQuote itself falls back to $0 shipping
// on any failure (missing config, unmapped country, ShipEngine down), so
// this route only ever fails on malformed input (zod) — a checkout page
// must never break because a shipping quote couldn't be fetched.
shippingQuoteRouter.post("/", checkoutRateLimiter, async (req, res, next) => {
  try {
    const input = shippingQuoteSchema.parse(req.body);
    const quote = await getShippingQuote(input);
    res.json(quote);
  } catch (err) {
    next(err);
  }
});
