import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait a moment and try again." },
});

// Unauthenticated (no customer login exists yet — see products.routes.ts),
// so this is the only thing standing between the reserve endpoint and abuse.
export const reserveRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reservation attempts. Please wait a moment and try again." },
});

// Same situation as reserveRateLimiter — /orders/checkout has no customer
// auth to rely on yet.
export const checkoutRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please wait a moment and try again." },
});
