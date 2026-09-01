import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { upload } from "../lib/upload";
import { env } from "../lib/env";
import { getStoreSettings, updateStoreSettings } from "../services/settings.service";
import { clearAllData, resetSeedData } from "../services/dataReset.service";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

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
});

settingsRouter.patch("/", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const input = updateSettingsSchema.parse(req.body);
    const settings = await updateStoreSettings(input);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// Uploads a new logo image and sets it as the store's logo in one step —
// reuses the same disk-storage multer instance as product images.
settingsRouter.post(
  "/logo",
  requireRole(AdminRole.ADMIN),
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
settingsRouter.delete("/logo", requireRole(AdminRole.ADMIN), async (_req, res, next) => {
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
  requireRole(AdminRole.ADMIN),
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
  requireRole(AdminRole.ADMIN),
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
