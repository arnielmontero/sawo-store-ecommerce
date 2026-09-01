"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api";

// No websockets in this stack — a periodic refetch is the simplest way to
// keep the unread badge roughly current without introducing new
// infrastructure, matching how the rest of the admin panel works.
const POLL_INTERVAL_MS = 30_000;

const TYPE_LABELS: Record<AppNotification["type"], string> = {
  RETURN_REQUEST_PENDING: "Return request",
  LOW_STOCK: "Inventory",
  ORDER_STALE: "Order",
};

function formatRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchNotifications()
      .then((result) => {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load notifications."));
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  async function handleOpenNotification(notification: AppNotification) {
    setOpen(false);
    if (!notification.isRead) {
      // Optimistic — don't make the admin wait on a round trip just to
      // navigate to the thing they clicked.
      setNotifications((prev) =>
        prev ? prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)) : prev
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationRead(notification.id).catch(() => {});
    }
    router.push(notification.link);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => (prev ? prev.map((n) => ({ ...n, isRead: true })) : prev));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative text-ink-500 hover:text-ink-900"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-ink-100 bg-white py-1 shadow-lg">
            <div className="flex items-center justify-between px-4 py-2">
              <p className="text-sm font-semibold text-ink-900">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto border-t border-ink-100">
              {error ? (
                <p className="px-4 py-6 text-center text-sm text-brand-600">{error}</p>
              ) : !notifications ? (
                <p className="px-4 py-6 text-center text-sm text-ink-500">Loading...</p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-500">You&apos;re all caught up.</p>
              ) : (
                <ul>
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <button
                        onClick={() => handleOpenNotification(notification)}
                        className={`block w-full px-4 py-3 text-left hover:bg-gray-50 ${
                          notification.isRead ? "" : "bg-brand-50/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                            {TYPE_LABELS[notification.type]}
                          </span>
                          <span className="shrink-0 text-xs text-ink-400">
                            {formatRelative(notification.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-ink-900">{notification.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{notification.body}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5 1.5 5h-13S5 12 5 8Z" />
      <path d="M8.5 16a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}
