"use client";

import { useEffect, useRef, useState } from "react";
import {
  updateStoreSettings as saveStoreSettings,
  uploadStoreLogo,
  removeStoreLogo,
  setAllowPartialRefunds,
  clearAllData,
  resetSeedData,
} from "@/lib/api";
import { useStoreSettings } from "@/lib/store-settings-context";
import { useAuth } from "@/lib/auth-context";

export default function ConfigurationPage() {
  const { user } = useAuth();
  const { settings, setSettings } = useStoreSettings();
  const [storeName, setStoreName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [refundsSaving, setRefundsSaving] = useState(false);
  const [refundsError, setRefundsError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingReset, setPendingReset] = useState<"clear" | "seed" | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetRunning, setResetRunning] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setStoreName(settings.storeName);
  }, [settings]);

  const canEdit = user?.role === "ADMIN";

  async function handleSave() {
    setError(null);
    setSaved(false);
    if (!storeName.trim()) {
      setError("Store name can't be empty.");
      return;
    }
    setSaving(true);
    try {
      const updated = await saveStoreSettings(storeName.trim());
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File) {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const updated = await uploadStoreLogo(file);
      setSettings(updated);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Failed to upload logo.");
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleLogoRemove() {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const updated = await removeStoreLogo();
      setSettings(updated);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Failed to remove logo.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handlePartialRefundsToggle(next: boolean) {
    setRefundsError(null);
    setRefundsSaving(true);
    try {
      const updated = await setAllowPartialRefunds(next);
      setSettings(updated);
    } catch (err) {
      setRefundsError(err instanceof Error ? err.message : "Failed to update refund setting.");
    } finally {
      setRefundsSaving(false);
    }
  }

  function openResetConfirm(action: "clear" | "seed") {
    setPendingReset(action);
    setResetConfirmText("");
    setResetError(null);
    setResetResult(null);
  }

  function closeResetConfirm() {
    if (resetRunning) return;
    setPendingReset(null);
    setResetConfirmText("");
  }

  async function handleConfirmReset() {
    if (resetConfirmText !== "RESET" || !pendingReset) return;
    setResetRunning(true);
    setResetError(null);
    try {
      const { message } = pendingReset === "clear" ? await clearAllData() : await resetSeedData();
      setResetResult(message);
      setPendingReset(null);
      setResetConfirmText("");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Failed to run reset.");
    } finally {
      setResetRunning(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900">Configuration</h1>
      <p className="mt-1 text-sm text-ink-500">Store-wide settings for this admin panel.</p>

      <div className="mt-6 max-w-xl rounded-xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-medium text-ink-900">General</p>

        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
            Store logo
          </label>
          <p className="mt-1 text-xs text-ink-400">
            Shown in the sidebar. If no logo is uploaded, the store name&apos;s first letter is used instead.
          </p>
          <div className="mt-2 flex items-center gap-4">
            {settings?.logoUrl ? (
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-ink-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logoUrl} alt="Store logo" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-ink-900 text-lg font-bold text-white">
                {(storeName || "S").slice(0, 1).toUpperCase()}
              </div>
            )}
            {canEdit && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {logoUploading ? "Working..." : settings?.logoUrl ? "Replace logo" : "Upload logo"}
                  </button>
                  {settings?.logoUrl && (
                    <button
                      onClick={handleLogoRemove}
                      disabled={logoUploading}
                      className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {logoError && <p className="text-xs text-brand-600">{logoError}</p>}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
              }}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-ink-100 pt-5">
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">
            Store name
          </label>
          <p className="mt-1 text-xs text-ink-400">Shown in the sidebar and used across the admin panel.</p>
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value.slice(0, 60))}
            disabled={!canEdit}
            className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-ink-400"
          />
        </div>

        {error && <p className="mt-4 text-sm text-brand-600">{error}</p>}
        {saved && !error && <p className="mt-4 text-sm text-emerald-600">Saved.</p>}

        {canEdit ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-5 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        ) : (
          <p className="mt-5 text-xs text-ink-400">Only Admin users can change store settings.</p>
        )}
      </div>

      <div className="mt-6 max-w-xl rounded-xl border border-ink-100 bg-white p-6">
        <p className="text-sm font-medium text-ink-900">Orders</p>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink-900">Allow partial refunds</p>
            <p className="mt-1 text-xs text-ink-400">
              When on, staff can refund an order for less than its full amount, restocking only the items/quantities
              actually being returned. The order stays open (Partially Refunded) until fully resolved. When off,
              refunds are always for the full order amount.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={settings?.allowPartialRefunds ?? false}
            onClick={() => canEdit && handlePartialRefundsToggle(!settings?.allowPartialRefunds)}
            disabled={!canEdit || refundsSaving}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
              settings?.allowPartialRefunds ? "bg-brand-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                settings?.allowPartialRefunds ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
        {refundsError && <p className="mt-3 text-sm text-brand-600">{refundsError}</p>}
        {!canEdit && <p className="mt-3 text-xs text-ink-400">Only Admin users can change this setting.</p>}
      </div>

      {canEdit && (
        <div className="mt-6 max-w-xl rounded-xl border border-brand-200 bg-brand-50/40 p-6">
          <p className="text-sm font-medium text-brand-700">Danger Zone</p>
          <p className="mt-1 text-xs text-ink-500">
            These actions affect customers, orders, and the product catalog only — admin accounts, your login, and
            the settings on this page (store name, logo, partial refunds) are never touched.
          </p>

          <div className="mt-5 flex items-start justify-between gap-4 border-t border-brand-100 pt-5">
            <div>
              <p className="text-sm font-medium text-ink-900">Clear all data</p>
              <p className="mt-1 text-xs text-ink-400">
                Permanently deletes every customer, order, and catalog product/category, resetting their counts to
                zero. Tables and fields stay as they are — only the rows are removed.
              </p>
            </div>
            <button
              onClick={() => openResetConfirm("clear")}
              className="shrink-0 rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              Clear data
            </button>
          </div>

          <div className="mt-5 flex items-start justify-between gap-4 border-t border-brand-100 pt-5">
            <div>
              <p className="text-sm font-medium text-ink-900">Reset seed data</p>
              <p className="mt-1 text-xs text-ink-400">
                Clears all data the same way, then reloads the full demo dataset — customers, catalog, and a year of
                sample orders — so the admin panel looks like an active store again.
              </p>
            </div>
            <button
              onClick={() => openResetConfirm("seed")}
              className="shrink-0 rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              Reset seed data
            </button>
          </div>

          {resetResult && <p className="mt-5 text-xs text-emerald-600">{resetResult}</p>}
        </div>
      )}

      {pendingReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-ink-900">
              {pendingReset === "clear" ? "Clear all data?" : "Reset seed data?"}
            </p>
            <p className="mt-2 text-sm text-ink-600">
              {pendingReset === "clear"
                ? "This permanently deletes every customer, order, and catalog product. This can't be undone."
                : "This permanently deletes every customer, order, and catalog product, then reloads the full demo dataset. This can't be undone."}
            </p>
            <p className="mt-3 text-xs text-ink-500">
              Type <span className="font-mono font-semibold text-ink-900">RESET</span> to confirm.
            </p>
            <input
              autoFocus
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              disabled={resetRunning}
              placeholder="RESET"
              className="mt-2 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
            />
            {resetError && <p className="mt-3 text-sm text-brand-600">{resetError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeResetConfirm}
                disabled={resetRunning}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetConfirmText !== "RESET" || resetRunning}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {resetRunning
                  ? "Working..."
                  : pendingReset === "clear"
                    ? "Clear all data"
                    : "Reset seed data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
