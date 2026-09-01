import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { AdminRole } from "@prisma/client";
import { upload, uploadCsv } from "../lib/upload";
import { env } from "../lib/env";
import {
  addProductImage,
  bulkAdjustPrice,
  bulkSetActive,
  bulkSetCategory,
  createCategory,
  createProduct,
  deactivateProduct,
  deleteCategory,
  deleteProductImage,
  generateVariantMatrix,
  getProductById,
  getProductBySlug,
  listCategories,
  listProducts,
  listTags,
  reorderProductImages,
  setFeaturedImage,
  setVariantStock,
  setVariantActive,
  updateCategory,
  updateProduct,
} from "../services/product.service";
import { exportProductsCsv, importProductsCsv } from "../services/productCsv.service";

export const productsRouter = Router();

const listQuerySchema = z.object({
  category: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(["name", "price", "stock", "createdAt"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

// Public — paginated product listing with category/price filtering.
productsRouter.get("/", async (req, res, next) => {
  try {
    const { category, tag, search, minPrice, maxPrice, page, sortBy, sortDir } = listQuerySchema.parse(
      req.query
    );
    const result = await listProducts({
      category,
      tag,
      search,
      minPriceCents: minPrice,
      maxPriceCents: maxPrice,
      page,
      sortBy,
      sortDir,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Everything under /admin is backoffice-only. Registered as a distinct
// prefix (rather than reusing "/" or "/:slug") so it never collides with
// the public slug lookup below, and so an admin can see inactive products
// that the public routes intentionally hide.
const adminRouter = Router();
productsRouter.use("/admin", requireAuth, adminRouter);

adminRouter.get("/", async (req, res, next) => {
  try {
    const { category, tag, search, minPrice, maxPrice, page, sortBy, sortDir } = listQuerySchema.parse(
      req.query
    );
    const result = await listProducts({
      category,
      tag,
      search,
      minPriceCents: minPrice,
      maxPriceCents: maxPrice,
      page,
      sortBy,
      sortDir,
      includeInactive: true,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await listCategories();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

const categoryBodySchema = z.object({ name: z.string().min(1).max(60) });

adminRouter.post("/categories", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const { name } = categoryBodySchema.parse(req.body);
    const category = await createCategory(name);
    res.status(201).json({ category });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/categories/:id", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const { name } = categoryBodySchema.parse(req.body);
    const category = await updateCategory(Number(req.params.id), name);
    res.json({ category });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/categories/:id", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    await deleteCategory(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/tags", async (_req, res, next) => {
  try {
    const tags = await listTags();
    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

// ── CSV import/export — registered before "/:id" so "export"/"import"
// never get parsed as a product id. ──────────────────────────────────

adminRouter.get("/export", async (_req, res, next) => {
  try {
    const csv = await exportProductsCsv();
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="catalog-export.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

adminRouter.post(
  "/import",
  requireRole(AdminRole.ADMIN),
  uploadCsv.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, "No CSV file uploaded");
      const csvText = fs.readFileSync(req.file.path, "utf-8");
      const result = await importProductsCsv(csvText);
      fs.unlinkSync(req.file.path);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ── Bulk actions ───────────────────────────────────────────────────────

const bulkIdsSchema = z.object({ productIds: z.array(z.number().int().positive()).min(1) });

adminRouter.post("/bulk/activate", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const { productIds } = bulkIdsSchema.parse(req.body);
    await bulkSetActive(productIds, true);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/bulk/deactivate", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const { productIds } = bulkIdsSchema.parse(req.body);
    await bulkSetActive(productIds, false);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const bulkCategorySchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1),
  categoryId: z.number().int().positive().nullable(),
});

adminRouter.post("/bulk/category", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const { productIds, categoryId } = bulkCategorySchema.parse(req.body);
    await bulkSetCategory(productIds, categoryId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const bulkPriceSchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1),
  percent: z.number().min(-95).max(1000),
});

adminRouter.post("/bulk/price", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const { productIds, percent } = bulkPriceSchema.parse(req.body);
    await bulkAdjustPrice(productIds, percent);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Single product ───────────────────────────────────────────────────

adminRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const product = await getProductById(id);
    if (!product) throw new HttpError(404, "Product not found");
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

const updateProductSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, alphanumeric, hyphen-separated")
    .optional(),
  description: z.string().optional(),
  basePriceCents: z.number().int().positive().optional(),
  compareAtPriceCents: z.number().int().positive().nullable().optional(),
  saleStartsAt: z.string().datetime().nullable().optional(),
  saleEndsAt: z.string().datetime().nullable().optional(),
  currency: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(320).optional(),
  sortOrder: z.number().int().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string().min(1)).optional(),
  variants: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        sku: z.string().min(1),
        priceCents: z.number().int().positive(),
        attributes: z.record(z.unknown()).optional(),
        imageUrl: z.string().url().nullable().optional(),
        compareAtPriceCents: z.number().int().positive().nullable().optional(),
        saleStartsAt: z.string().datetime().nullable().optional(),
        saleEndsAt: z.string().datetime().nullable().optional(),
      })
    )
    .optional(),
});

adminRouter.patch("/:id", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const input = updateProductSchema.parse(req.body);
    const product = await updateProduct(id, input);
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/:id", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const product = await deactivateProduct(id);
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// ── Variant matrix generation ─────────────────────────────────────────

const variantMatrixSchema = z.object({
  options: z
    .array(z.object({ name: z.string().min(1), values: z.array(z.string().min(1)).min(1) }))
    .min(1),
});

adminRouter.post("/:id/variants/generate", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { options } = variantMatrixSchema.parse(req.body);
    const product = await generateVariantMatrix(id, options);
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

const stockSchema = z.object({ stockQuantity: z.number().int().nonnegative() });

adminRouter.patch(
  "/variants/:variantId/stock",
  requireRole(AdminRole.ADMIN, AdminRole.FULFILLMENT_STAFF),
  async (req, res, next) => {
    try {
      const variantId = Number(req.params.variantId);
      const { stockQuantity } = stockSchema.parse(req.body);
      const inventory = await setVariantStock(variantId, stockQuantity);
      res.json({ inventory });
    } catch (err) {
      next(err);
    }
  }
);

const variantActiveSchema = z.object({ isActive: z.boolean() });

// Toggles a single variant's storefront visibility independent of the
// parent product or any sibling variant — same ADMIN-only gate as
// deactivating a whole product.
adminRouter.patch(
  "/variants/:variantId/active",
  requireRole(AdminRole.ADMIN),
  async (req, res, next) => {
    try {
      const variantId = Number(req.params.variantId);
      const { isActive } = variantActiveSchema.parse(req.body);
      const variant = await setVariantActive(variantId, isActive);
      res.json({ variant });
    } catch (err) {
      next(err);
    }
  }
);

// ── Product images ────────────────────────────────────────────────────

adminRouter.post(
  "/:id/images",
  requireRole(AdminRole.ADMIN),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!req.file) throw new HttpError(400, "No file uploaded");
      const url = `${env.API_BASE_URL}/uploads/${req.file.filename}`;
      const image = await addProductImage(id, url);
      res.status(201).json({ image });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.delete("/:id/images/:imageId", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const imageId = Number(req.params.imageId);
    await deleteProductImage(id, imageId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch(
  "/:id/images/:imageId/feature",
  requireRole(AdminRole.ADMIN),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const imageId = Number(req.params.imageId);
      await setFeaturedImage(id, imageId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

const reorderSchema = z.object({ orderedImageIds: z.array(z.number().int().positive()).min(1) });

adminRouter.patch("/:id/images/reorder", requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { orderedImageIds } = reorderSchema.parse(req.body);
    await reorderProductImages(id, orderedImageIds);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Public — single product with its active variants and current stock
// availability (stockQuantity - reservedQuantity), so a storefront can show
// "in stock" / "out of stock" per variant without a separate call.
productsRouter.get("/:slug", async (req, res, next) => {
  try {
    const product = await getProductBySlug(req.params.slug);
    if (!product) throw new HttpError(404, "Product not found");
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

const createProductSchema = z.object({
  title: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, alphanumeric, hyphen-separated"),
  description: z.string().optional(),
  basePriceCents: z.number().int().positive(),
  compareAtPriceCents: z.number().int().positive().optional(),
  saleStartsAt: z.string().datetime().nullable().optional(),
  saleEndsAt: z.string().datetime().nullable().optional(),
  currency: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  metaTitle: z.string().max(70).optional(),
  metaDescription: z.string().max(320).optional(),
  categoryId: z.number().int().positive().optional(),
  tags: z.array(z.string().min(1)).optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().min(1),
        priceCents: z.number().int().positive(),
        attributes: z.record(z.unknown()).optional(),
        initialStock: z.number().int().nonnegative().optional(),
        imageUrl: z.string().url().optional(),
      })
    )
    .min(1, "At least one variant is required"),
});

// Admin only — creates a product along with its base variants.
productsRouter.post("/", requireAuth, requireRole(AdminRole.ADMIN), async (req, res, next) => {
  try {
    const input = createProductSchema.parse(req.body);
    const product = await createProduct(input);
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
});
