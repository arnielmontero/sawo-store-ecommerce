import EasyPost from "@easypost/api";
import { getEasypostApiKey } from "./credentials";

// Built fresh per call (not a module-level singleton) because the API key
// can now come from StoreSettings and change at runtime via Configuration.
// Returns null when no key is configured anywhere (DB or .env) — callers
// treat that as "tracking isn't set up yet" and degrade gracefully (see
// shipping.service.ts), same as before this became runtime-configurable.
export async function getEasypost() {
  const apiKey = await getEasypostApiKey();
  return apiKey ? new EasyPost(apiKey) : null;
}
