import { Router } from "express";
import { z } from "zod";
import { AdminRole } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { upload } from "../lib/upload";
import { env } from "../lib/env";
import { getStoreSettings, updateStoreSettings } from "../services/settings.service";

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
