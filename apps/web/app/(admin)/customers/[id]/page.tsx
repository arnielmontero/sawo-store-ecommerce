"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  answerQuestion,
  fetchCustomer,
  updateCustomerProfile,
  type CustomerDetail,
} from "@/lib/api";
import { formatCents, formatPaymentMethod } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth-context";
import { hasPermission } from "@/lib/permissions";
import { CartLeadsCard } from "@/components/CartLeadsCard";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500" title={`${rating}/5`}>
      {"★".repeat(rating)}
      <span className="text-ink-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

const PROFILE_FIELDS: { key: keyof ProfileDraft; label: string }[] = [
  { key: "name", label: "Full name" },
  { key: "phone", label: "Phone" },
  { key: "addressLine1", label: "Address line 1" },
  { key: "addressLine2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "state", label: "State / Province" },
  { key: "postalCode", label: "Postal code" },
  { key: "country", label: "Country" },
];

interface ProfileDraft {
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

function draftFromCustomer(customer: CustomerDetail): ProfileDraft {
  return {
    name: customer.name ?? "",
    phone: customer.phone ?? "",
    addressLine1: customer.addressLine1 ?? "",
    addressLine2: customer.addressLine2 ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    postalCode: customer.postalCode ?? "",
    country: customer.country ?? "",
  };
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [answeringId, setAnsweringId] = useState<number | null>(null);

  const customerId = Number(params.id);
  const canEdit = hasPermission(user, "customers", "edit");
  const canLog = hasPermission(user, "customers", "logActivity");

  function load() {
    fetchCustomer(customerId)
      .then((c) => {
        setCustomer(c);
        setProfileDraft(draftFromCustomer(c));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load customer."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [customerId]);

  async function handleSaveProfile() {
    if (!profileDraft) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      const updated = await updateCustomerProfile(customerId, {
        name: profileDraft.name.trim() || null,
        phone: profileDraft.phone.trim() || null,
        addressLine1: profileDraft.addressLine1.trim() || null,
        addressLine2: profileDraft.addressLine2.trim() || null,
        city: profileDraft.city.trim() || null,
        state: profileDraft.state.trim() || null,
        postalCode: profileDraft.postalCode.trim() || null,
        country: profileDraft.country.trim() || null,
      });
      setCustomer((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditingProfile(false);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAnswer(id: number) {
    const answer = answerDrafts[id];
    if (!answer?.trim()) return;
    setAnsweringId(id);
    try {
      await answerQuestion(id, answer.trim());
      load();
      setAnswerDrafts((prev) => ({ ...prev, [id]: "" }));
    } finally {
      setAnsweringId(null);
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading...</p>;
  if (error) return <p className="text-sm text-brand-600">{error}</p>;
  if (!customer) return null;

  const hasAddress = customer.addressLine1 || customer.city || customer.postalCode;

  return (
    <div>
      <Link href="/customers" className="text-sm text-ink-500 hover:text-brand-600">
        ← Back to Customers
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">{customer.name || customer.email}</h1>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Joined</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">{new Date(customer.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Orders</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">{customer.orders.length}</p>
        </div>
        <div className="rounded-xl border border-ink-100 bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-ink-500">Total spent</p>
          <p className="mt-1 text-lg font-semibold text-ink-900">{formatCents(customer.totalSpentCents)}</p>
        </div>
      </div>

      {/* ── Full customer information ────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Customer information</p>
          {canEdit && !editingProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50"
            >
              Edit
            </button>
          )}
        </div>

        <div className="px-5 py-4">
          {editingProfile && profileDraft ? (
            <div className="grid max-w-2xl grid-cols-2 gap-4">
              {PROFILE_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium uppercase tracking-wide text-ink-500">{field.label}</label>
                  <input
                    value={profileDraft[field.key]}
                    onChange={(e) => setProfileDraft((prev) => (prev ? { ...prev, [field.key]: e.target.value } : prev))}
                    className="mt-1.5 w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              ))}
              {profileError && <p className="col-span-2 text-sm text-brand-600">{profileError}</p>}
              <div className="col-span-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingProfile(false);
                    setProfileDraft(draftFromCustomer(customer));
                    setProfileError(null);
                  }}
                  disabled={savingProfile}
                  className="rounded-md border border-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {savingProfile ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-500">Email</dt>
                <dd className="mt-1 text-ink-900">{customer.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-500">Phone</dt>
                <dd className="mt-1 text-ink-900">{customer.phone || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-ink-500">Address</dt>
                <dd className="mt-1 text-ink-900">
                  {hasAddress ? (
                    <>
                      {customer.addressLine1}
                      {customer.addressLine2 && <>, {customer.addressLine2}</>}
                      <br />
                      {[customer.city, customer.state, customer.postalCode].filter(Boolean).join(", ")}
                      {customer.country && <>, {customer.country}</>}
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {/* ── Total products purchased ─────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Products purchased</p>
        </div>
        {customer.productsPurchased.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No completed purchases yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">Quantity</th>
                  <th className="px-3 py-3 font-medium">Total spent</th>
                </tr>
              </thead>
              <tbody>
                {customer.productsPurchased.map((p) => (
                  <tr key={p.productId} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-ink-900">
                      <Link href={`/catalog/${p.productId}`} className="hover:text-brand-600 hover:underline">
                        {p.productTitle}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{p.quantity}</td>
                    <td className="px-3 py-3 text-ink-700">{formatCents(p.totalSpentCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Transactions ──────────────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Transactions</p>
          <p className="mt-0.5 text-xs text-ink-400">
            Card details come straight from Stripe (never raw card numbers) — blank for orders that never reached a real charge.
          </p>
        </div>

        {customer.orders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">Items</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Payment</th>
                  <th className="px-3 py-3 font-medium">Card</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id} className="border-b border-ink-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-ink-900">
                      <Link href={`/orders/${order.id}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 hover:underline">
                        {order.reference} <span className="font-sans text-ink-400">↗</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                    <td className="px-3 py-3 text-ink-700">{formatCents(order.totalCents, order.currency)}</td>
                    <td className="px-3 py-3 text-ink-700">{formatPaymentMethod(order.paymentMethod)}</td>
                    <td className="px-3 py-3 text-ink-700">
                      {order.cardBrand && order.cardLast4 ? (
                        <span className="font-mono text-xs uppercase">
                          {order.cardBrand} •••• {order.cardLast4}
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                      {order.paymentDeclineCode && (
                        <p className="mt-0.5 text-xs text-brand-600">Declined: {order.paymentDeclineCode}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-3 text-ink-700">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Cart interest (leads) ────────────────────────────────────── */}
      <CartLeadsCard userId={customerId} cartLeads={customer.cartLeads} canLog={canLog} onReload={load} />

      {/* ── Reviews ──────────────────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Reviews ({customer.reviews.length})</p>
        </div>
        {customer.reviews.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No reviews from this customer yet.</p>
        ) : (
          <ul className="space-y-4 px-5 py-4">
            {customer.reviews.map((review) => (
              <li key={review.id} className="rounded-lg border border-ink-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stars rating={review.rating} />
                    {review.product && (
                      <Link href={`/catalog/${review.product.id}`} className="text-xs text-ink-500 hover:text-brand-600 hover:underline">
                        {review.product.title}
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-ink-500">{formatDateTime(review.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-ink-900">{review.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Q&A ──────────────────────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <p className="text-sm font-medium text-ink-900">Questions asked ({customer.questions.length})</p>
        </div>
        {customer.questions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">No questions from this customer yet.</p>
        ) : (
          <ul className="space-y-4 px-5 py-4">
            {customer.questions.map((q) => (
              <li key={q.id} className="rounded-lg border border-ink-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        q.answeredAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {q.answeredAt ? "Answered" : "Unanswered"}
                    </span>
                    {q.product && (
                      <Link href={`/catalog/${q.product.id}`} className="text-xs text-ink-500 hover:text-brand-600 hover:underline">
                        {q.product.title}
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-ink-500">{formatDateTime(q.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-ink-900">{q.question}</p>
                {q.answer ? (
                  <p className="mt-2 rounded-md bg-gray-50 p-2 text-sm text-ink-700">
                    <span className="font-medium">{q.answeredByName}: </span>
                    {q.answer}
                  </p>
                ) : (
                  canLog && (
                    <div className="mt-3 border-t border-ink-100 pt-3">
                      <textarea
                        value={answerDrafts[q.id] ?? ""}
                        onChange={(e) => setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        rows={2}
                        placeholder="Write a public answer..."
                        className="w-full rounded-md border border-ink-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      />
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => handleAnswer(q.id)}
                          disabled={answeringId === q.id || !answerDrafts[q.id]?.trim()}
                          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                        >
                          {answeringId === q.id ? "Working..." : "Post answer"}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
