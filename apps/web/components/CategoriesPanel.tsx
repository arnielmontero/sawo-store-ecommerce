"use client";

import { useEffect, useState } from "react";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  type Category,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/permissions";

export function CategoriesPanel({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  // Called after any create/rename/delete so the caller (Catalog page) can
  // refresh its own category filter dropdown — this panel keeps its own
  // list in sync internally, but has no way to reach into the parent's
  // separately-fetched copy.
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const canEdit = hasPermission(user, "catalog", "edit");

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  function load() {
    fetchCategories()
      .then(setCategories)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load categories."));
  }

  useEffect(load, []);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreateError(null);
    setCreating(true);
    try {
      await createCategory(trimmed);
      setNewName("");
      load();
      onChanged();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create category.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditingName(category.name);
    setRowError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleSaveEdit(id: number) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    setRowError(null);
    setSavingId(id);
    try {
      await updateCategory(id, trimmed);
      setEditingId(null);
      load();
      onChanged();
    } catch (err) {
      setRowError({ id, message: err instanceof Error ? err.message : "Failed to rename category." });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(category: Category) {
    setRowError(null);
    setDeletingId(category.id);
    try {
      await deleteCategory(category.id);
      load();
      onChanged();
    } catch (err) {
      setRowError({
        id: category.id,
        message: err instanceof Error ? err.message : "Failed to delete category.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Categories</h2>
            <p className="mt-0.5 text-xs text-ink-500">Organize the catalog into browsable groups.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-500 hover:bg-gray-50 hover:text-ink-900"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6">
          {canEdit && (
            <div className="mb-6">
              <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
                New category
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.slice(0, 60))}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. Outdoor Accessories"
                  disabled={creating}
                  className="flex-1 rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="shrink-0 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {creating ? "Adding..." : "Add"}
                </button>
              </div>
              {createError && <p className="mt-2 text-xs text-brand-600">{createError}</p>}
            </div>
          )}

          {error ? (
            <p className="text-sm text-brand-600">{error}</p>
          ) : !categories ? (
            <p className="text-sm text-ink-500">Loading...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-ink-500">No categories yet.</p>
          ) : (
            <ul className="space-y-2">
              {categories.map((category) => {
                const isEditing = editingId === category.id;
                const productCount = category._count?.products ?? 0;
                return (
                  <li key={category.id} className="rounded-lg border border-ink-100 p-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value.slice(0, 60))}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(category.id)}
                          disabled={savingId === category.id}
                          className="flex-1 rounded-md border border-ink-100 px-2 py-1 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => handleSaveEdit(category.id)}
                          disabled={savingId === category.id || !editingName.trim()}
                          className="shrink-0 rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                        >
                          {savingId === category.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={savingId === category.id}
                          className="shrink-0 rounded-md border border-ink-100 px-3 py-1 text-xs font-medium text-ink-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-ink-900">{category.name}</p>
                          <p className="text-xs text-ink-400">
                            {productCount} product{productCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0 gap-1">
                            <button
                              onClick={() => startEdit(category)}
                              className="rounded-md px-2 py-1 text-xs font-medium text-ink-600 hover:bg-gray-50"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => handleDelete(category)}
                              disabled={deletingId === category.id || productCount > 0}
                              title={
                                productCount > 0
                                  ? "Reassign or remove its products before deleting"
                                  : undefined
                              }
                              className="rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-ink-300 disabled:hover:bg-transparent"
                            >
                              {deletingId === category.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {rowError?.id === category.id && (
                      <p className="mt-2 text-xs text-brand-600">{rowError.message}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!canEdit && (
            <p className="mt-6 text-xs text-ink-400">Only Admin users can create, rename, or delete categories.</p>
          )}
        </div>
      </div>
    </div>
  );
}
