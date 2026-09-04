import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { ApiEnvironment } from "@prisma/client";
import { requireAuth, requirePermission } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { upload } from "../lib/upload";
import { env } from "../lib/env";
import { getStoreSettings, updateStoreSettings, getPublicBranding } from "../services/settings.service";
import { clearAllData, resetSeedData } from "../services/dataReset.service";
import { isMailerConfigured, verifyMailer } from "../lib/mailer";

export const settingsRouter = Router();

// Public, unauthenticated — the storefront's favicon/title and any other
// public branding reads reach this before requireAuth below applies to
// everything else on this router.
settingsRouter.get("/branding", async (_req, res, next) => {
  try {
    const branding = await getPublicBranding();
    res.json(branding);
  } catch (err) {
    next(err);
  }
});

settingsRouter.use(requireAuth);

// Lets Configuration confirm the SMTP credentials in .env actually connect
// without needing a real order to send a test invoice through.
settingsRouter.get("/mail/test", requirePermission("configuration", "edit"), async (_req, res, next) => {
  try {
    if (!isMailerConfigured()) {
      return res.json({ configured: false, ok: false, error: "SMTP settings aren't set in the API's .env." });
    }
    const result = await verifyMailer();
    res.json({ configured: true, ...result });
  } catch (err) {
    next(err);
  }
});

settingsRouter.get("/", async (_req, res, next) => {
  try {
    const settings = await getStoreSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

const updateSettingsSchema = z.object({
  storeName: z.string().min(1).max(60).optional(),
  logoUrl: z.string().url().nullable().optional(),
  allowPartialRefunds: z.boolean().optional(),
  defaultCarrier: z.string().min(1).max(40).optional(),
  // Which tracking provider shipping.service.ts uses when an order is
  // marked shipped. Both are wired up: EasyPost tracks a manually-entered
  // number; ShipStation (ShipEngine) can additionally purchase a real
  // label and generate the tracking number itself.
  deliveryProvider: z.enum(["EASYPOST", "SHIPSTATION"]).optional(),
  // The store's own shipping-origin address — required (all except street2)
  // before a ShipEngine label purchase will proceed, see
  // shipping.service.ts's buyShipEngineLabel.
  shipFromName: z.string().max(100).optional(),
  shipFromPhone: z.string().max(30).optional(),
  shipFromStreet1: z.string().max(200).optional(),
  shipFromStreet2: z.string().max(200).optional(),
  shipFromCity: z.string().max(100).optional(),
  shipFromState: z.string().max(50).optional(),
  shipFromZip: z.string().max(20).optional(),
  shipFromCountry: z.string().max(2).optional(),
  // Which credential pair is actually live — see lib/credentials.ts.
  // Switching TO production is intentionally not a plain field flip: see
  // the explicit confirm check below, since it changes whether Stripe
  // charges/EasyPost trackers are real.
  apiEnvironment: z.nativeEnum(ApiEnvironment).optional(),
  confirmProduction: z.literal("LIVE").optional(),
  // Sandbox/test and live API credentials — see lib/credentials.ts.
  // Trimmed and treated as "leave unchanged" when empty, so re-saving the
  // form without touching a key field never blanks out what was already
  // stored (the frontend never has the real value to send back, only
  // whether it's set — see settings.service.ts's getStoreSettings).
  stripeSecretKeyTest: z.string().max(500).optional(),
  stripeWebhookSecretTest: z.string().max(500).optional(),
  easypostApiKeyTest: z.string().max(500).optional(),
  shipstationApiKeyTest: z.string().max(500).optional(),
  stripeSecretKeyLive: z.string().max(500).optional(),
  stripeWebhookSecretLive: z.string().max(500).optional(),
  easypostApiKeyLive: z.string().max(500).optional(),
  shipstationApiKeyLive: z.string().max(500).optional(),
});

settingsRouter.patch("/", requirePermission("configuration", "edit"), async (req, res, next) => {
  try {
    const parsedBody = updateSettingsSchema.parse(req.body);
    if (parsedBody.apiEnvironment === ApiEnvironment.PRODUCTION && parsedBody.confirmProduction !== "LIVE") {
      throw new HttpError(
        400,
        'Switching to Production requires confirmProduction: "LIVE" — this makes Stripe charges and EasyPost trackers real.'
      );
    }
    const settings = await updateStoreSettings(parsedBody);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// Uploads a new logo image and sets it as the store's logo in one step —
// reuses the same disk-storage multer instance as product images.
settingsRouter.post(
  "/logo",
  requirePermission("configuration", "edit"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, "No file uploaded");
      const logoUrl = `${env.API_BASE_URL}/uploads/${req.file.filename}`;
      const settings = await updateStoreSettings({ logoUrl });
      res.status(201).json({ settings });
    } catch (err) {
      next(err);
    }
  }
);

// Clears the logo back to the default initial-letter fallback.
settingsRouter.delete("/logo", requirePermission("configuration", "edit"), async (_req, res, next) => {
  try {
    const settings = await updateStoreSettings({ logoUrl: null });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// Destructive data-management actions live behind their own middleware so
// that a bug in one route's authorization can't accidentally leave the
// other exposed — every request here must be an authenticated ADMIN AND
// the server itself must not be running in production, regardless of what
// the UI shows or hides. This isn't a real production safety mechanism in
// its current form (a single always-inert-in-prod switch is not a
// substitute for a genuine staging/production split, and NODE_ENV is
// trivial to leave unset) — it exists to keep an obviously destructive
// action from ever being one honest misclick away in a deployed store.
function blockInProduction(_req: Request, _res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "production") {
    throw new HttpError(403, "Data reset is disabled in production.");
  }
  next();
}

const resetConfirmSchema = z.object({ confirm: z.literal("RESET") });

// Wipes every order/customer/catalog row (see dataReset.service.ts for
// exactly what's kept: admin accounts and store settings survive). The
// client is expected to make the admin type a confirmation phrase before
// this is ever called, but the server re-validates the same phrase in the
// body rather than trusting that the UI actually enforced it.
settingsRouter.post(
  "/reset/clear",
  blockInProduction,
  requirePermission("configuration", "resetData"),
  async (req, res, next) => {
    try {
      resetConfirmSchema.parse(req.body);
      await clearAllData();
      res.json({ message: "All store data cleared. Admin accounts and settings were kept." });
    } catch (err) {
      next(err);
    }
  }
);

// Same wipe as above, immediately followed by a full re-seed (customers,
// catalog, demo/bulk orders) — for going back to a known, realistic demo
// state rather than an empty store.
settingsRouter.post(
  "/reset/seed",
  blockInProduction,
  requirePermission("configuration", "resetData"),
  async (req, res, next) => {
    try {
      resetConfirmSchema.parse(req.body);
      const summary = await resetSeedData();
      res.json({ message: summary });
    } catch (err) {
      next(err);
    }
  }
);
