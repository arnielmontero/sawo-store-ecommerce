import Stripe from "stripe";
import { HttpError } from "../middleware/errorHandler";
import { getStripeSecretKey } from "./credentials";

// Built fresh per call (not a module-level singleton) because the secret
// key can now come from StoreSettings and change at runtime via
// Configuration — a singleton constructed once at import time would never
// pick up a key an admin pastes in later. Stripe's own client is cheap to
// construct (no network call), so there's no real cost to this.
export async function getStripe() {
  const secretKey = await getStripeSecretKey();
  if (!secretKey) {
    throw new HttpError(
      503,
      "Stripe isn't configured yet — add a Stripe test secret key in Configuration or STRIPE_SECRET_KEY in .env."
    );
  }
  return new Stripe(secretKey);
}
