"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  exportProductsCsvUrl,
  fetchCategories,
  fetchProducts,
  importProductsCsv,
  type Category,
  type Product,
  type ProductSortField,
  type SortDir,
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { CatalogBulkBar } from "@/components/CatalogBulkBar";

const LOW_STOCK_THRESHOLD = 10;
// Kept in sync with the backend's NEW_PRODUCT_DAYS (product.service.ts) —
// only used here for the badge tooltip text, not for any actual logic.
const NEW_PRODUCT_DAYS = 30;

const SORTABLE_COLUMNS: { field: ProductSortField; label: string }[] = [
  { field: "name", label: "Product" },
  { field: "price", label: "Price" },
  { field: "stock", label: "Stock" },
];

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ProductSortField | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce the search box so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function load() {
    setLoading(true);
    fetchProducts({ category: categoryFilter || undefined, search: search || undefined, page, sortBy, sortDir })
      .then((result) => {
        setProducts(result.products);
        setPagination(result.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load products."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(load, [categoryFilter, search, page, sortBy, sortDir]);

  function handleSort(field: ProductSortField) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === products.length ? new Set() : new Set(products.map((p) => p.id))));
  }

  async function handleExport() {
    const url = await exportProductsCsvUrl();
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalog-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importProductsCsv(file);
      setImportResult(
        `Imported: ${result.productsCreated} created, ${result.productsUpdated} updated products; ` +
          `${result.variantsCreated} created, ${result.variantsUpdated} updated variants.` +
          (result.errors.length > 0 ? ` ${result.errors.length} row(s) had issues.` : "")
      );
      load();
    } catch (err) {
      setImportResult(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function sortIndicator(field: ProductSortField) {
    if (sortBy !== field) return null;
    return <span className="ml-1 text-ink-400">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Catalog</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import CSV"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
            }}
          />
          <Link
            href="/catalog/new"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            New Product
          </Link>
        </div>
      </div>

      {importResult && (
        <p className="mt-4 rounded-md bg-gray-50 px-4 py-2 text-sm text-ink-700">{importResult}</p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-ink-100 bg-white">
        {selected.size > 0 && (
          <CatalogBulkBar
            selectedIds={Array.from(selected)}
            categories={categories}
            onDone={() => {
              setSelected(new Set());
              load();
            }}
            onClear={() => setSelected(new Set())}
          />
        )}

        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Products ({pagination.total})</p>
          <div className="flex items-center gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products..."
              className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
        ) : loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
        ) : products.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            {pagination.total === 0 && !search && !categoryFilter
              ? "No products yet."
              : "No products match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-ink-300"
                    />
                  </th>
                  {SORTABLE_COLUMNS.map((col) => (
                    <th key={col.field} className="px-3 py-3 font-medium">
                      <button
                        onClick={() => handleSort(col.field)}
                        className="flex items-center hover:text-ink-900"
                      >
                        {col.label}
                        {sortIndicator(col.field)}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Tags</th>
                  <th className="px-3 py-3 font-medium">Variants</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="rounded border-ink-300"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/catalog/${product.id}`} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100">
                          {product.featuredImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.featuredImageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-ink-300">—</span>
                          )}
                        </div>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-900 hover:text-brand-600 hover:underline">
                            {product.title}
                          </span>
                          {(product.isBestSeller || product.isNew || product.isOnSale) && (
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              {product.isBestSeller && (
                                <span
                                  className="inline-flex rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                                  title="Among the top sellers by completed units sold"
                                >
                                  Best Seller
                                </span>
                              )}
                              {product.isNew && (
                                <span
                                  className="inline-flex rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
                                  title={`Added within the last ${NEW_PRODUCT_DAYS} days`}
                                >
                                  New
                                </span>
                              )}
                              {product.isOnSale && (
                                <span
                                  className="inline-flex rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                                  title={product.saleEndsAt ? `Deal ends ${new Date(product.saleEndsAt).toLocaleString()}` : "Compare-at price is set above the current price"}
                                >
                                  Sale{product.saleEndsAt ? ` · ends ${new Date(product.saleEndsAt).toLocaleDateString()}` : ""}
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      {product.compareAtPriceCents ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-brand-600">
                            {formatCents(product.basePriceCents, product.currency)}
                          </span>
                          <span className="text-xs text-ink-400 line-through">
                            {formatCents(product.compareAtPriceCents, product.currency)}
                          </span>
                        </span>
                      ) : (
                        formatCents(product.basePriceCents, product.currency)
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-700">
                      <span className="flex items-center gap-1.5">
                        <span className={product.totalStock <= LOW_STOCK_THRESHOLD ? "font-medium text-brand-600" : ""}>
                          {product.totalStock}
                        </span>
                        {product.totalStock <= LOW_STOCK_THRESHOLD && (
                          <span
                            className="inline-flex rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600"
                            title={`At or below the low-stock threshold of ${LOW_STOCK_THRESHOLD} units`}
                          >
                            Low
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{product.category?.name ?? "—"}</td>
                    <td className="px-3 py-3">
                      {product.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {product.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-ink-600"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-ink-700">{product.variantCount}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          product.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-ink-500"
                        }`}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
            <p className="text-xs text-ink-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} products)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
