import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { AdminRole } from "@prisma/client";
import { upload } from "../lib/upload";
import { env } from "../lib/env";

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth, requireRole(AdminRole.ADMIN, AdminRole.MANAGER));

// Accepts a single image file (field name "file"), stores it to local disk
// (see lib/upload.ts), and returns the absolute URL to save on a
// Product/ProductVariant/ProductImage row.
uploadsRouter.post("/", upload.single("file"), (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const url = `${env.API_BASE_URL}/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
});
