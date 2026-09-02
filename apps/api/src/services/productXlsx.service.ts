import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { toXlsx, fromXlsx } from "../lib/xlsx";

// One row per variant (not per product) — this is the convention every
// mainstream platform (Shopify included) uses for product spreadsheets,
// since a spreadsheet naturally wants one row per sellable SKU. Rows
// sharing the same "Handle" (slug) are grouped back into one product on
// import.
const HEADERS = [
  "Handle",
  "Title",
  "Description",
  "Category",
  "Tags",
  "Base Price",
  "Compare At Price",
  "SKU",
  "Variant Price",
  "Attributes",
  "Stock",
  "Image URL",
];

export async function exportProductsXlsx(): Promise<Buffer> {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      tags: { include: { tag: true } },
      variants: { include: { inventory: true } },
    },
    orderBy: { id: "asc" },
  });

  const rows: (string | number)[][] = [];
  for (const product of products) {
    const tags = product.tags.map((pt) => pt.tag.name).join(";");
    if (product.variants.length === 0) {
      rows.push([
        product.slug,
        product.title,
        product.description ?? "",
        product.category?.name ?? "",
        tags,
        product.basePriceCents / 100,
        product.compareAtPriceCents ? product.compareAtPriceCents / 100 : "",
        "",
        "",
        "",
        "",
        product.imageUrl ?? "",
      ]);
      continue;
    }
    for (const variant of product.variants) {
      rows.push([
        product.slug,
        product.title,
        product.description ?? "",
        product.category?.name ?? "",
        tags,
        product.basePriceCents / 100,
        product.compareAtPriceCents ? product.compareAtPriceCents / 100 : "",
        variant.sku,
        variant.priceCents / 100,
        variant.attributes ? JSON.stringify(variant.attributes) : "",
        variant.inventory?.stockQuantity ?? 0,
        variant.imageUrl ?? "",
      ]);
    }
  }

  return toXlsx(HEADERS, rows, "Products");
}

export interface XlsxImportResult {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  errors: string[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Imports/upserts products and variants from an .xlsx file in the same
// shape exportProductsXlsx produces. Matches products by Handle (slug) and
// variants by SKU, so re-importing an exported file is a safe no-op, and
// editing quantities in a spreadsheet then re-importing updates stock in
// bulk. Malformed rows are collected into `errors` and skipped rather than
// aborting the whole import.
export async function importProductsXlsx(buffer: Buffer): Promise<XlsxImportResult> {
  const rows = await fromXlsx(buffer);
  if (rows.length === 0) {
    return { productsCreated: 0, productsUpdated: 0, variantsCreated: 0, variantsUpdated: 0, errors: ["Empty file"] };
  }

  const [header, ...dataRows] = rows;
  const col = (name: string) => header.indexOf(name);
  const idx = {
    handle: col("Handle"),
    title: col("Title"),
    description: col("Description"),
    category: col("Category"),
    tags: col("Tags"),
    basePrice: col("Base Price"),
    compareAtPrice: col("Compare At Price"),
    sku: col("SKU"),
    variantPrice: col("Variant Price"),
    attributes: col("Attributes"),
    stock: col("Stock"),
    imageUrl: col("Image URL"),
  };
  if (idx.handle === -1 || idx.title === -1 || idx.basePrice === -1) {
    return {
      productsCreated: 0,
      productsUpdated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      errors: ["Missing required columns: Handle, Title, Base Price"],
    };
  }

  const result: XlsxImportResult = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    errors: [],
  };

  // Group rows by Handle so multi-variant products (several rows) become
  // one product create/update instead of one per row.
  const byHandle = new Map<string, string[][]>();
  for (const row of dataRows) {
    const handle = row[idx.handle]?.trim();
    if (!handle) {
      result.errors.push(`Row skipped: missing Handle (${row.join(",")})`);
      continue;
    }
    if (!byHandle.has(handle)) byHandle.set(handle, []);
    byHandle.get(handle)!.push(row);
  }

  for (const [handle, productRows] of byHandle) {
    const first = productRows[0];
    const title = first[idx.title]?.trim();
    const basePriceCents = Math.round(parseFloat(first[idx.basePrice]) * 100);

    if (!title || isNaN(basePriceCents) || basePriceCents <= 0) {
      result.errors.push(`Handle "${handle}" skipped: invalid Title or Base Price`);
      continue;
    }

    const categoryName = idx.category !== -1 ? first[idx.category]?.trim() : "";
    let categoryId: number | undefined;
    if (categoryName) {
      const category = await prisma.category.upsert({
        where: { slug: slugify(categoryName) },
        update: {},
        create: { name: categoryName, slug: slugify(categoryName) },
      });
      categoryId = category.id;
    }

    const compareAtRaw = idx.compareAtPrice !== -1 ? first[idx.compareAtPrice]?.trim() : "";
    const compareAtPriceCents = compareAtRaw ? Math.round(parseFloat(compareAtRaw) * 100) : undefined;

    const existing = await prisma.product.findUnique({ where: { slug: handle } });
    const productData = {
      title,
      description: idx.description !== -1 ? first[idx.description] || undefined : undefined,
      basePriceCents,
      compareAtPriceCents,
      categoryId,
      imageUrl: idx.imageUrl !== -1 ? first[idx.imageUrl] || undefined : undefined,
    };

    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data: productData })
      : await prisma.product.create({ data: { ...productData, slug: handle } });

    if (existing) result.productsUpdated++;
    else result.productsCreated++;

    const tagsRaw = idx.tags !== -1 ? first[idx.tags]?.trim() : "";
    if (tagsRaw) {
      const tagNames = tagsRaw.split(";").map((t) => t.trim()).filter(Boolean);
      const tagIds: number[] = [];
      for (const name of tagNames) {
        const tag = await prisma.tag.upsert({
          where: { slug: slugify(name) },
          update: {},
          create: { name, slug: slugify(name) },
        });
        tagIds.push(tag.id);
      }
      await prisma.productTag.deleteMany({ where: { productId: product.id } });
      await prisma.productTag.createMany({
        data: tagIds.map((tagId) => ({ productId: product.id, tagId })),
        skipDuplicates: true,
      });
    }

    for (const row of productRows) {
      const sku = idx.sku !== -1 ? row[idx.sku]?.trim() : "";
      if (!sku) continue; // product-only row (no variant on this line)

      const variantPriceRaw = idx.variantPrice !== -1 ? row[idx.variantPrice]?.trim() : "";
      const priceCents = variantPriceRaw ? Math.round(parseFloat(variantPriceRaw) * 100) : basePriceCents;
      const stockRaw = idx.stock !== -1 ? row[idx.stock]?.trim() : "";
      const stockQuantity = stockRaw ? parseInt(stockRaw, 10) : 0;
      let attributes: Record<string, unknown> | undefined;
      const attrRaw = idx.attributes !== -1 ? row[idx.attributes]?.trim() : "";
      if (attrRaw) {
        try {
          attributes = JSON.parse(attrRaw);
        } catch {
          result.errors.push(`SKU "${sku}": Attributes column is not valid JSON, ignored`);
        }
      }

      if (isNaN(priceCents) || priceCents <= 0) {
        result.errors.push(`SKU "${sku}" skipped: invalid Variant Price`);
        continue;
      }

      const existingVariant = await prisma.productVariant.findUnique({ where: { sku } });
      if (existingVariant) {
        await prisma.productVariant.update({
          where: { sku },
          data: {
            priceCents,
            attributes: attributes as Prisma.InputJsonValue | undefined,
            imageUrl: idx.imageUrl !== -1 ? row[idx.imageUrl] || undefined : undefined,
          },
        });
        if (!isNaN(stockQuantity)) {
          await prisma.inventory.upsert({
            where: { variantId: existingVariant.id },
            update: { stockQuantity },
            create: { variantId: existingVariant.id, stockQuantity },
          });
        }
        result.variantsUpdated++;
      } else {
        await prisma.productVariant.create({
          data: {
            sku,
            priceCents,
            attributes: attributes as Prisma.InputJsonValue | undefined,
            productId: product.id,
            imageUrl: idx.imageUrl !== -1 ? row[idx.imageUrl] || undefined : undefined,
            inventory: { create: { stockQuantity: isNaN(stockQuantity) ? 0 : stockQuantity } },
          },
        });
        result.variantsCreated++;
      }
    }
  }

  return result;
}
