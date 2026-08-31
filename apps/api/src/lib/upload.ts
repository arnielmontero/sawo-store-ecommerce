import crypto from "crypto";
import path from "path";
import multer from "multer";
import { HttpError } from "../middleware/errorHandler";

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // Random filename (never the client-supplied name) so a malicious
  // filename can't traverse directories or collide with another upload —
  // the original extension is kept only for correct content-type serving.
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new HttpError(400, "Only JPEG, PNG, WEBP, and GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});

// Separate instance for CSV import — same disk storage, different
// mimetype allowlist and a smaller size cap (spreadsheets, not photos).
const CSV_MIME_TYPES = new Set(["text/csv", "application/vnd.ms-excel", "text/plain"]);

export const uploadCsv = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!CSV_MIME_TYPES.has(file.mimetype) && !file.originalname.toLowerCase().endsWith(".csv")) {
      cb(new HttpError(400, "Only CSV files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export { UPLOAD_DIR };
