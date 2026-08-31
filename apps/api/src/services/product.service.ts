import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";

const PAGE_SIZE = 20;

// A product counts as "New" for this many days after creation — purely a
// display badge, doesn't affect ordering or filtering elsewhere.
const NEW_PRODUCT_DAYS = 30;
// Top N products by completed units sold are flagged "Best Seller". Small
// and fixed rather than a percentile/threshold because the catalog is small;
// revisit if the catalog grows into the hundreds of products.
const BEST_SELLER_COUNT = 5;
// Only orders that represent a real completed sale count toward "units
// sold" — PENDING (not yet paid) and CANCELLED/REFUNDED/RETURNED (reversed)
// shouldn't make a product look like a best seller.
const COMPLETED_ORDER_STATUSES = ["PAID", "SHIPPED", "DELIVERED"] as const;

// Admin callers see every variant (active and inactive) so they can review
// and re-enable a discontinued one; storefront callers only ever see active
// variants — same includeInactive distinction the Product-level filtering
// already uses, just applied one level down.
function buildInclude(includeInactiveVariants: boolean) {
  return {
    category: true,
    variants: {
      where: includeInactiveVariants ? {} : { isActive: true },
      include: { inventory: true },
    },
    images: { orderBy: { position: "asc" as const } },
    tags: { include: { tag: true } },
  };
}

const adminInclude = buildInclude(true);

// Flattens the ProductTag join rows into a plain Tag[] for API responses —
// callers shouldn't need to know the join table exists.
function withFlatTags<T extends { tags: { tag: { id: number; name: string; slug: string } }[] }>(
  product: T
) {
  return { ...product, tags: product.tags.map((pt) => pt.tag) };
}

// Ranks products by completed units sold (across all variants) and returns
// the id set for the top BEST_SELLER_COUNT — computed over the FULL sales
// history, not just the current page/filter, so the badge reflects actual
// standing rather than shifting with whatever page you're looking at.
async function getBestSellerProductIds(): Promise<Set<number>> {
  const rows: { productId: number }[] = await prisma.$queryRaw`
    SELECT v.productId AS productId, SUM(oi.quantity) AS unitsSold
    FROM OrderItem oi
    JOIN ProductVariant v ON v.id = oi.variantId
    JOIN \`Order\` o ON o.id = oi.orderId
    WHERE o.status IN (${Prisma.join(COMPLETED_ORDER_STATUSES)})
    GROUP BY v.productId
    ORDER BY unitsSold DESC
    LIMIT ${BEST_SELLER_COUNT}
  `;
  return new Set(rows.map((r) => r.productId));
}

function isNewProduct(createdAt: Date): boolean {
  const ageMs = Date.now() - createdAt.getTime();
  return ageMs <= NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000;
}

// A deal is "active" when a compare-at price is set AND (if the admin
// scheduled a window) the current time falls within [saleStartsAt,
// saleEndsAt]. Either bound left null means that side is unbounded, so a
// product can be put on sale immediately (no start) and/or run indefinitely
// (no end) without the admin having to fill in both dates.
function isSaleActive(
  compareAtPriceCents: number | null,
  basePriceCents: number,
  saleStartsAt: Date | null,
  saleEndsAt: Date | null
): boolean {
  if (compareAtPriceCents == null || compareAtPriceCents <= basePriceCents) return false;
  const now = Date.now();
  if (saleStartsAt && now < saleStartsAt.getTime()) return false;
  if (saleEndsAt && now > saleEndsAt.getTime()) return false;
  return true;
}

// Stamps each variant with its own isOnSale (falls back to the product's
// deal when the variant has no compareAtPriceCents of its own — a variant
// without an override still shows the product-wide sale) and returns
// whether ANY variant ended up on sale, so callers can OR that into the
// product-level isOnSale without duplicating the fallback logic.
function annotateVariantSales<
  V extends { priceCents: number; compareAtPriceCents: number | null; saleStartsAt: Date | null; saleEndsAt: Date | null }
>(
  variants: V[],
  productCompareAtPriceCents: number | null,
  productSaleStartsAt: Date | null,
  productSaleEndsAt: Date | null
) {
  let anyOnSale = false;
  const annotated = variants.map((variant) => {
    const hasOwnDeal = variant.compareAtPriceCents != null;
    const compareAtPriceCents = hasOwnDeal ? variant.compareAtPriceCents : productCompareAtPriceCents;
    const saleStartsAt = hasOwnDeal ? variant.saleStartsAt : productSaleStartsAt;
    const saleEndsAt = hasOwnDeal ? variant.saleEndsAt : productSaleEndsAt;
    const isOnSale = isSaleActive(compareAtPriceCents, variant.priceCents, saleStartsAt, saleEndsAt);
    if (isOnSale) anyOnSale = true;
    return { ...variant, isOnSale, compareAtPriceCents: hasOwnDeal ? variant.compareAtPriceCents : null };
  });
  return { variants: annotated, anyOnSale };
}

export type ProductSortField = "name" | "price" | "stock" | "createdAt";
export type SortDir = "asc" | "desc";

export interface ListProductsFilters {
  category?: string;
  tag?: string;
  search?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  page?: number;
  sortBy?: ProductSortField;
  sortDir?: SortDir;
  // Storefront callers only ever see active products; the admin Catalog
  // page needs to see deactivated ones too (that's the whole point of
  // being able to review/reactivate them), so this is opt-in per caller.
  includeInactive?: boolean;
}

export async function listProducts(filters: ListProductsFilters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const sortDir = filters.sortDir === "desc" ? "desc" : "asc";

  const where: Prisma.ProductWhereInput = {
    ...(filters.includeInactive ? {} : { isActive: true }),
    ...(filters.category ? { category: { slug: filters.category } } : {}),
    ...(filters.tag ? { tags: { some: { tag: { slug: filters.tag } } } } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search } },
            { slug: { contains: filters.search } },
          ],
        }
      : {}),
    ...(filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined
      ? {
          basePriceCents: {
            ...(filters.minPriceCents !== undefined ? { gte: filters.minPriceCents } : {}),
            ...(filters.maxPriceCents !== undefined ? { lte: filters.maxPriceCents } : {}),
          },
        }
      : {}),
  };

  const include = buildInclude(!!filters.includeInactive);
  type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof adminInclude }>;
  let rawProducts: ProductWithRelations[];
  let total: number;

  if (filters.sortBy === "stock") {
    // totalStock is an aggregate across a product's variants, computed in
    // JS everywhere else — but sorting correctly across the FULL dataset
    // (not just the current page) needs the aggregation done in SQL before
    // paginating, so this path is a raw query instead of reusing the
    // Prisma findMany below. Storefront callers only sum active variants'
    // stock, matching what buildInclude() would return for the same caller.
    const ids = await prisma.product.findMany({ where, select: { id: true } });
    const idList = ids.map((p) => p.id);
    total = idList.length;

    if (idList.length === 0) {
      rawProducts = [];
    } else {
      const variantFilter = filters.includeInactive ? Prisma.empty : Prisma.raw("AND v.isActive = 1");
      const ordered: { id: number }[] = await prisma.$queryRaw`
        SELECT p.id, COALESCE(SUM(i.stockQuantity), 0) AS totalStock
        FROM Product p
        LEFT JOIN ProductVariant v ON v.productId = p.id ${variantFilter}
        LEFT JOIN Inventory i ON i.variantId = v.id
        WHERE p.id IN (${Prisma.join(idList)})
        GROUP BY p.id
        ORDER BY totalStock ${Prisma.raw(sortDir === "desc" ? "DESC" : "ASC")}
        LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
      `;
      const orderedIds = ordered.map((row) => row.id);
      const fetched = await prisma.product.findMany({
        where: { id: { in: orderedIds } },
        include,
      });
      const byId = new Map(fetched.map((p) => [p.id, p]));
      rawProducts = orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    }
  } else {
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      filters.sortBy === "name"
        ? [{ title: sortDir }]
        : filters.sortBy === "price"
          ? [{ basePriceCents: sortDir }]
          : filters.sortBy === "createdAt"
            ? [{ createdAt: sortDir }]
            : [{ sortOrder: "asc" }, { createdAt: "desc" }];

    [rawProducts, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.product.count({ where }),
    ]);
  }

  const bestSellerIds = await getBestSellerProductIds();

  // variantCount/totalStock are a convenience for list views (e.g. the admin
  // Catalog table) so they don't need a second request per product just to
  // show "3 variants, 210 in stock". featuredImageUrl resolves the gallery
  // down to the one thumbnail a list view needs, falling back to the legacy
  // single imageUrl column for rows created before ProductImage existed.
  // isBestSeller/isNew/isOnSale are computed badges — not stored — so they
  // always reflect current sales/age/pricing rather than needing a backfill
  // job whenever the underlying data changes.
  const products = rawProducts.map((product) => {
    const flat = withFlatTags(product);
    const featured = flat.images.find((img) => img.isFeatured) ?? flat.images[0];
    const { variants, anyOnSale } = annotateVariantSales(
      flat.variants,
      flat.compareAtPriceCents,
      flat.saleStartsAt,
      flat.saleEndsAt
    );
    return {
      ...flat,
      variants,
      variantCount: flat.variants.length,
      totalStock: flat.variants.reduce((sum, variant) => sum + (variant.inventory?.stockQuantity ?? 0), 0),
      featuredImageUrl: featured?.url ?? flat.imageUrl ?? null,
      isBestSeller: bestSellerIds.has(flat.id),
      isNew: isNewProduct(flat.createdAt),
      isOnSale:
        isSaleActive(flat.compareAtPriceCents, flat.basePriceCents, flat.saleStartsAt, flat.saleEndsAt) ||
        anyOnSale,
    };
  });

  return {
    products,
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
  };
}

// Admin view of a single product — unlike getProductBySlug, this doesn't
// filter on isActive (an admin needs to open a deactivated product to
// review or reactivate it) and is looked up by id, matching the admin
// Catalog page's /catalog/:id route.
export async function getProductById(id: number) {
  const product = await prisma.product.findUnique({ where: { id }, include: adminInclude });
  if (!product) return null;
  const flat = withFlatTags(product);
  const bestSellerIds = await getBestSellerProductIds();
  const { variants, anyOnSale } = annotateVariantSales(
    flat.variants,
    flat.compareAtPriceCents,
    flat.saleStartsAt,
    flat.saleEndsAt
  );
  return {
    ...flat,
    variants,
    isBestSeller: bestSellerIds.has(flat.id),
    isNew: isNewProduct(flat.createdAt),
    isOnSale:
      isSaleActive(flat.compareAtPriceCents, flat.basePriceCents, flat.saleStartsAt, flat.saleEndsAt) || anyOnSale,
  };
}

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

export async function listTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Tags are created on the fly by name — an admin typing a new tag into the
// product form shouldn't have to go manage a separate Tags screen first.
async function resolveTagIds(tagNames: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of tagNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const slug = slugify(trimmed);
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name: trimmed, slug },
    });
    ids.push(tag.id);
  }
  return ids;
}

export interface UpdateProductInput {
  title?: string;
  slug?: string;
  description?: string;
  basePriceCents?: number;
  compareAtPriceCents?: number | null;
  // Optional deal window — null clears a bound (sale runs open-ended on
  // that side). See the schema comment on Product.saleStartsAt/saleEndsAt.
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  currency?: string;
  imageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  sortOrder?: number;
  categoryId?: number | null;
  isActive?: boolean;
  tags?: string[];
  // Variants are upserted by id (existing) or created (no id) — this form
  // intentionally never deletes a variant here, since a variant can be
  // referenced by existing OrderItems and removing it would break order
  // history. Deactivate the parent product instead of removing variants.
  variants?: Array<{
    id?: number;
    sku: string;
    priceCents: number;
    attributes?: Record<string, unknown>;
    imageUrl?: string | null;
    // Per-variant deal override — see the schema comment on
    // ProductVariant.compareAtPriceCents. Omitting these keys leaves the
    // variant's existing deal untouched; pass null to clear one.
    compareAtPriceCents?: number | null;
    saleStartsAt?: string | null;
    saleEndsAt?: string | null;
  }>;
}

export async function updateProduct(id: number, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Product not found");

  await prisma.$transaction(async (tx) => {
    if (input.variants) {
      for (const variant of input.variants) {
        if (variant.id) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: variant.sku,
              priceCents: variant.priceCents,
              attributes: variant.attributes as Prisma.InputJsonValue | undefined,
              imageUrl: variant.imageUrl,
              compareAtPriceCents: variant.compareAtPriceCents,
              saleStartsAt:
                variant.saleStartsAt === undefined ? undefined : variant.saleStartsAt ? new Date(variant.saleStartsAt) : null,
              saleEndsAt:
                variant.saleEndsAt === undefined ? undefined : variant.saleEndsAt ? new Date(variant.saleEndsAt) : null,
            },
          });
        } else {
          await tx.productVariant.create({
            data: {
              sku: variant.sku,
              priceCents: variant.priceCents,
              attributes: variant.attributes as Prisma.InputJsonValue | undefined,
              imageUrl: variant.imageUrl,
              compareAtPriceCents: variant.compareAtPriceCents,
              saleStartsAt: variant.saleStartsAt ? new Date(variant.saleStartsAt) : null,
              saleEndsAt: variant.saleEndsAt ? new Date(variant.saleEndsAt) : null,
              productId: id,
              inventory: { create: { stockQuantity: 0 } },
            },
          });
        }
      }
    }

    if (input.tags) {
      const tagIds = await resolveTagIds(input.tags);
      await tx.productTag.deleteMany({ where: { productId: id } });
      if (tagIds.length > 0) {
        await tx.productTag.createMany({
          data: tagIds.map((tagId) => ({ productId: id, tagId })),
          skipDuplicates: true,
        });
      }
    }

    await tx.product.update({
      where: { id },
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description,
        basePriceCents: input.basePriceCents,
        compareAtPriceCents: input.compareAtPriceCents,
        saleStartsAt: input.saleStartsAt === undefined ? undefined : input.saleStartsAt ? new Date(input.saleStartsAt) : null,
        saleEndsAt: input.saleEndsAt === undefined ? undefined : input.saleEndsAt ? new Date(input.saleEndsAt) : null,
        currency: input.currency,
        imageUrl: input.imageUrl,
        metaTitle: input.metaTitle,
        metaDescription: input.metaDescription,
        sortOrder: input.sortOrder,
        categoryId: input.categoryId,
        isActive: input.isActive,
      },
    });
  });

  return getProductById(id);
}

// Soft delete — a product with order history can't be safely removed from
// the database (it would orphan OrderItem rows and corrupt past orders), so
// "delete" here means isActive: false, same mechanism as manually toggling
// a product off. It disappears from the storefront and the default admin
// list, but stays fully intact for order history and can be reactivated.
export async function deactivateProduct(id: number) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Product not found");

  return prisma.product.update({ where: { id }, data: { isActive: false } });
}

// Toggles a single variant's storefront visibility (e.g. discontinuing one
// color/size while the rest of the product stays live) without touching the
// parent product or any sibling variant.
export async function setVariantActive(variantId: number, isActive: boolean) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new HttpError(404, "Variant not found");

  return prisma.productVariant.update({ where: { id: variantId }, data: { isActive } });
}

// Directly sets a variant's on-hand stock (e.g. after a restock delivery or
// a physical count correction) — distinct from reserveStock/commitReservedStock
// in inventory.service.ts, which only ever move stock as a side effect of
// the order lifecycle. This never touches reservedQuantity, so an admin
// correcting stock can't accidentally erase an in-flight reservation.
export async function setVariantStock(variantId: number, stockQuantity: number) {
  const inventory = await prisma.inventory.findUnique({ where: { variantId } });
  if (!inventory) throw new HttpError(404, "Variant not found");

  return prisma.inventory.update({ where: { variantId }, data: { stockQuantity } });
}

// ── Product images ────────────────────────────────────────────────────

export async function addProductImage(productId: number, url: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new HttpError(404, "Product not found");

  const existingCount = await prisma.productImage.count({ where: { productId } });

  return prisma.productImage.create({
    data: {
      productId,
      url,
      position: existingCount,
      // First image uploaded becomes the featured one automatically, so a
      // product never ends up with a gallery but no thumbnail.
      isFeatured: existingCount === 0,
    },
  });
}

export async function deleteProductImage(productId: number, imageId: number) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image || image.productId !== productId) throw new HttpError(404, "Image not found");

  await prisma.productImage.delete({ where: { id: imageId } });

  // If the deleted image was featured, promote the next one in position
  // order so the product doesn't silently lose its thumbnail.
  if (image.isFeatured) {
    const next = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { position: "asc" },
    });
    if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isFeatured: true } });
  }
}

export async function setFeaturedImage(productId: number, imageId: number) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image || image.productId !== productId) throw new HttpError(404, "Image not found");

  await prisma.$transaction([
    prisma.productImage.updateMany({ where: { productId }, data: { isFeatured: false } }),
    prisma.productImage.update({ where: { id: imageId }, data: { isFeatured: true } }),
  ]);
}

export async function reorderProductImages(productId: number, orderedImageIds: number[]) {
  const images = await prisma.productImage.findMany({ where: { productId } });
  const validIds = new Set(images.map((img) => img.id));
  if (orderedImageIds.length !== images.length || orderedImageIds.some((id) => !validIds.has(id))) {
    throw new HttpError(400, "orderedImageIds must include exactly the product's current image ids");
  }

  await prisma.$transaction(
    orderedImageIds.map((imageId, position) =>
      prisma.productImage.update({ where: { id: imageId }, data: { position } })
    )
  );
}

// ── Bulk actions ───────────────────────────────────────────────────────

export async function bulkSetActive(productIds: number[], isActive: boolean) {
  await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { isActive } });
}

export async function bulkSetCategory(productIds: number[], categoryId: number | null) {
  await prisma.product.updateMany({ where: { id: { in: productIds } }, data: { categoryId } });
}

// Adjusts basePriceCents for every listed product by a percentage
// (e.g. -10 for "10% off everything selected"). Applied per-row rather than
// in SQL so rounding is predictable and consistent with formatCents.
export async function bulkAdjustPrice(productIds: number[], percent: number) {
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, basePriceCents: true },
  });

  await prisma.$transaction(
    products.map((p) =>
      prisma.product.update({
        where: { id: p.id },
        data: { basePriceCents: Math.max(1, Math.round(p.basePriceCents * (1 + percent / 100))) },
      })
    )
  );
}

// ── Variant matrix generation ─────────────────────────────────────────

export interface VariantOption {
  name: string;
  values: string[];
}

function cartesianProduct(options: VariantOption[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, option) =>
      acc.flatMap((combo) => option.values.map((value) => ({ ...combo, [option.name]: value }))),
    [{}]
  );
}

// Given e.g. [{name: "size", values: ["S","M","L"]}, {name: "color", values: ["Black","White"]}],
// generates all 6 combinations as new variants under the product, each with
// a generated SKU and the product's base price. Skips any combination whose
// SKU already exists on the product (so re-running after adding a new size
// doesn't duplicate the sizes that already exist).
export async function generateVariantMatrix(productId: number, options: VariantOption[]) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true },
  });
  if (!product) throw new HttpError(404, "Product not found");
  if (options.length === 0 || options.some((o) => o.values.length === 0)) {
    throw new HttpError(400, "Each option needs at least one value");
  }

  const combos = cartesianProduct(options);
  const existingAttrKeys = new Set(
    product.variants.map((v) => JSON.stringify(v.attributes ?? {}))
  );
  const baseSlug = slugify(product.title).toUpperCase().slice(0, 12);

  const toCreate = combos
    .filter((combo) => !existingAttrKeys.has(JSON.stringify(combo)))
    .map((combo, i) => {
      const suffix = Object.values(combo).join("-").toUpperCase().replace(/[^A-Z0-9-]/g, "");
      return {
        sku: `${baseSlug}-${suffix || i}`,
        priceCents: product.basePriceCents,
        attributes: combo as Prisma.InputJsonValue,
        productId,
        inventory: { create: { stockQuantity: 0 } },
      };
    });

  if (toCreate.length === 0) return getProductById(productId);

  await prisma.$transaction(toCreate.map((data) => prisma.productVariant.create({ data })));
  return getProductById(productId);
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: true,
      // Storefront view — a variant switched off individually shouldn't be
      // visible/selectable here even though its parent product is active.
      variants: { where: { isActive: true }, include: { inventory: true } },
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!product) return null;

  const bestSellerIds = await getBestSellerProductIds();
  const { variants: saleVariants, anyOnSale } = annotateVariantSales(
    product.variants,
    product.compareAtPriceCents,
    product.saleStartsAt,
    product.saleEndsAt
  );

  return {
    ...product,
    variants: saleVariants.map((variant) => ({
      ...variant,
      availableStock: variant.inventory
        ? variant.inventory.stockQuantity - variant.inventory.reservedQuantity
        : 0,
    })),
    isBestSeller: bestSellerIds.has(product.id),
    isNew: isNewProduct(product.createdAt),
    isOnSale:
      isSaleActive(product.compareAtPriceCents, product.basePriceCents, product.saleStartsAt, product.saleEndsAt) ||
      anyOnSale,
  };
}

export interface CreateProductInput {
  title: string;
  slug: string;
  description?: string;
  basePriceCents: number;
  compareAtPriceCents?: number;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  currency?: string;
  imageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  categoryId?: number;
  tags?: string[];
  variants: Array<{
    sku: string;
    priceCents: number;
    attributes?: Record<string, unknown>;
    initialStock?: number;
    imageUrl?: string;
  }>;
}

export async function createProduct(input: CreateProductInput) {
  const product = await prisma.product.create({
    data: {
      title: input.title,
      slug: input.slug,
      description: input.description,
      basePriceCents: input.basePriceCents,
      compareAtPriceCents: input.compareAtPriceCents,
      saleStartsAt: input.saleStartsAt ? new Date(input.saleStartsAt) : null,
      saleEndsAt: input.saleEndsAt ? new Date(input.saleEndsAt) : null,
      currency: input.currency,
      imageUrl: input.imageUrl,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      categoryId: input.categoryId,
      variants: {
        create: input.variants.map((variant) => ({
          sku: variant.sku,
          priceCents: variant.priceCents,
          attributes: variant.attributes as Prisma.InputJsonValue | undefined,
          imageUrl: variant.imageUrl,
          inventory: { create: { stockQuantity: variant.initialStock ?? 0 } },
        })),
      },
    },
    include: { variants: { include: { inventory: true } } },
  });

  if (input.tags && input.tags.length > 0) {
    const tagIds = await resolveTagIds(input.tags);
    await prisma.productTag.createMany({
      data: tagIds.map((tagId) => ({ productId: product.id, tagId })),
      skipDuplicates: true,
    });
  }

  return getProductById(product.id);
}
