"use client";

import { useEffect, useRef, useState } from "react";
import { updateStoreSettings as saveStoreSettings, uploadStoreLogo, removeStoreLogo } from "@/lib/api";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    </div>
  );
}
