"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
  type NotificationType,
} from "@/lib/api";

type TypeFilter = "" | NotificationType;

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All types" },
  { value: "RETURN_REQUEST_PENDING", label: "Return requests" },
  { value: "LOW_STOCK", label: "Inventory" },
  { value: "ORDER_STALE", label: "Orders" },
  { value: "QUESTION_PENDING", label: "Questions" },
];

const TYPE_LABELS: Record<NotificationType, string> = {
  RETURN_REQUEST_PENDING: "Return request",
  LOW_STOCK: "Inventory",
  ORDER_STALE: "Order",
  QUESTION_PENDING: "Question",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchNotifications({
      unreadOnly: unreadOnly || undefined,
      includeResolved: includeResolved || undefined,
      type: typeFilter || undefined,
      page,
    })
      .then((result) => {
        setNotifications(result.notifications);
        setPagination(result.pagination);
        setUnreadCount(result.unreadCount);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load notifications."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [unreadOnly, includeResolved, typeFilter, page]);

  async function handleOpen(notification: AppNotification) {
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationRead(notification.id).catch(() => {});
    }
    router.push(notification.link);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  }

  const hasFilters = unreadOnly || includeResolved || typeFilter;

  function clearFilters() {
    setUnreadOnly(false);
    setIncludeResolved(false);
    setTypeFilter("");
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="rounded-md border border-ink-100 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-ink-100 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-5 py-4">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as TypeFilter);
              setPage(1);
            }}
            className="rounded-md border border-ink-100 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:bg-white focus:ring-1 focus:ring-brand-500"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4"
            />
            Unread only
          </label>

          <label className="flex items-center gap-1.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => {
                setIncludeResolved(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4"
            />
            Show resolved
          </label>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-gray-50 hover:text-ink-900"
            >
              Clear filters
            </button>
          )}
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-brand-600">{error}</p>
        ) : loading ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-500">
            {hasFilters ? "No notifications match your filters." : "You're all caught up."}
          </p>
        ) : (
          <ul>
            {notifications.map((notification) => (
              <li key={notification.id} className="border-b border-ink-100 last:border-0">
                <button
                  onClick={() => handleOpen(notification)}
                  className={`block w-full px-5 py-4 text-left hover:bg-gray-50 ${
                    notification.isRead ? "" : "bg-brand-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                        {TYPE_LABELS[notification.type]}
                      </span>
                      {!notification.isRead && (
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                      )}
                      {notification.resolvedAt && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Resolved
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-ink-400">
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink-900">{notification.title}</p>
                  <p className="mt-0.5 text-sm text-ink-500">{notification.body}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
            <p className="text-xs text-ink-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} notifications)
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
