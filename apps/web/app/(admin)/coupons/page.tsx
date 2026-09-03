"use client";

import { useEffect, useState } from "react";
import {
  fetchCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  type Coupon,
  type CouponType,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/permissions";

const TYPE_OPTIONS: { value: CouponType; label: string }[] = [
  { value: "PERCENTAGE", label: "Percentage off" },
  { value: "FIXED_AMOUNT", label: "Fixed amount off" },
  { value: "FREE_SHIPPING", label: "Free shipping" },
];

function formatValue(coupon: Coupon): string {
  if (coupon.type === "PERCENTAGE") return `${coupon.value}%`;
  if (coupon.type === "FIXED_AMOUNT") return `$${((coupon.value ?? 0) / 100).toFixed(2)}`;
  return "Free shipping";
}

function formatWindow(coupon: Coupon): string {
  if (!coupon.startsAt && !coupon.endsAt) return "No expiry";
  const start = coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString() : "now";
  const end = coupon.endsAt ? new Date(coupon.endsAt).toLocaleDateString() : "indefinitely";
  return `${start} → ${end}`;
}

export default function CouponsPage() {
  const { user } = useAuth();
  const canEdit = hasPermission(user, "coupons", "edit");

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchCoupons()
      .then(setCoupons)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!code.trim()) {
      setFormError("Code is required.");
      return;
    }
    if (type !== "FREE_SHIPPING" && !value) {
      setFormError("Value is required for this coupon type.");
      return;
    }

    setSaving(true);
    try {
      const parsedValue = type === "FIXED_AMOUNT" ? Math.round(Number(value) * 100) : Number(value);
      const coupon = await createCoupon({
        code: code.trim().toUpperCase(),
        type,
        value: type === "FREE_SHIPPING" ? undefined : parsedValue,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        maxUses: maxUses ? Number(maxUses) : undefined,
      });
      setCoupons((prev) => [coupon, ...prev]);
      setCode("");
      setValue("");
      setEndsAt("");
      setMaxUses("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(coupon: Coupon) {
    const updated = await updateCoupon(coupon.id, { isActive: !coupon.isActive });
    setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? updated : c)));
  }

  async function handleDelete(coupon: Coupon) {
    try {
      await deleteCoupon(coupon.id);
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete coupon.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Coupons</h1>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        Discount codes customers can apply at checkout — percentage off, fixed amount off, or free shipping.
      </p>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">All coupons ({coupons.length})</p>
        </div>

        {loading ? (
          <p className="px-5 py-6 text-sm text-ink-500">Loading...</p>
        ) : coupons.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-400">No coupons yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-5 py-2 font-medium">Code</th>
                <th className="px-5 py-2 font-medium">Value</th>
                <th className="px-5 py-2 font-medium">Window</th>
                <th className="px-5 py-2 font-medium">Usage</th>
                <th className="px-5 py-2 font-medium">Status</th>
                {canEdit && <th className="px-5 py-2 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-5 py-2 font-mono text-ink-900">{coupon.code}</td>
                  <td className="px-5 py-2 text-ink-700">{formatValue(coupon)}</td>
                  <td className="px-5 py-2 text-ink-700">{formatWindow(coupon)}</td>
                  <td className="px-5 py-2 text-ink-700">
                    {coupon.usageCount} / {coupon.maxUses ?? "∞"}
                  </td>
                  <td className="px-5 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        coupon.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-ink-500"
                      }`}
                    >
                      {coupon.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-5 py-2 text-right">
                      <button
                        onClick={() => handleToggleActive(coupon)}
                        className="mr-3 text-xs font-medium text-brand-600 hover:underline"
                      >
                        {coupon.isActive ? "Deactivate" : "Activate"}
                      </button>
                      {coupon.usageCount === 0 && (
                        <button
                          onClick={() => handleDelete(coupon)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canEdit && (
          <form onSubmit={handleCreate} className="border-t border-ink-100 px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">New coupon</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-ink-500">Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="SAVE10"
                  className="mt-1 w-32 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-500">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as CouponType)}
                  className="mt-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {type !== "FREE_SHIPPING" && (
                <div>
                  <label className="block text-xs text-ink-500">
                    {type === "PERCENTAGE" ? "Percent (1-100)" : "Amount ($)"}
                  </label>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    min={type === "PERCENTAGE" ? 1 : 0.01}
                    max={type === "PERCENTAGE" ? 100 : undefined}
                    step={type === "PERCENTAGE" ? 1 : 0.01}
                    className="mt-1 w-28 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-ink-500">Expires (optional)</label>
                <input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="mt-1 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-500">Max uses (optional)</label>
                <input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  min={1}
                  placeholder="Unlimited"
                  className="mt-1 w-28 rounded-md border border-ink-100 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create coupon"}
              </button>
            </div>
            {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
