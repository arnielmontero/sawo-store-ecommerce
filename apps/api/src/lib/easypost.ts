import EasyPost from "@easypost/api";
import { env } from "./env";

// Null when EASYPOST_API_KEY isn't set (e.g. a fresh dev checkout before
// signing up for a sandbox key) — callers must check for this rather than
// this module throwing at import time, so the rest of the app still runs
// without live tracking configured. Mirrors STRIPE_SECRET_KEY being
// required, except tracking is a nice-to-have on top of shipping, not a
// blocking payment path, so it degrades instead of failing startup.
export const easypost = env.EASYPOST_API_KEY ? new EasyPost(env.EASYPOST_API_KEY) : null;
