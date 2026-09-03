"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStoreSettings } from "@/lib/store-settings-context";
import { useAuth } from "@/lib/auth-context";
import type { AdminRole } from "@/lib/api";

const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  FULFILLMENT_STAFF: "Staff",
};

interface NavItem {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  // Hidden from the nav entirely for non-ADMIN staff — the API enforces
  // this too (see staff.routes.ts), this just keeps a link a Fulfillment
  // staff member can't use from cluttering their sidebar.
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Dashboard and Configuration stay top/bottom-level (entry point and
// store-wide settings, neither belongs inside an operational group).
// Everything else is grouped by the part of the operation it belongs to —
// added here as new admin sections have grown past a flat list a staff
// member could scan in one glance.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Sales",
    items: [
      { href: "/orders", label: "Orders", icon: OrdersIcon },
      { href: "/payments", label: "Payments", icon: PaymentsIcon },
      { href: "/coupons", label: "Coupons", icon: CouponsIcon },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/catalog", label: "Catalog", icon: CatalogIcon },
      { href: "/inventory", label: "Inventory", icon: InventoryIcon },
      { href: "/reviews", label: "Reviews & Q&A", icon: ReviewsIcon },
    ],
  },
  {
    label: "Fulfillment",
    items: [{ href: "/deliveries", label: "Deliveries", icon: ShippingIcon }],
  },
  {
    label: "People",
    items: [
      { href: "/customers", label: "Customers", icon: CustomersIcon },
      { href: "/staff", label: "Staff", icon: StaffIcon, adminOnly: true },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
        active ? "bg-brand-50 text-brand-600" : "text-ink-700 hover:bg-gray-50 hover:text-ink-900"
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${active ? "text-brand-600" : "text-ink-500"}`} />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { settings } = useStoreSettings();
  const { user } = useAuth();
  const storeName = settings?.storeName ?? "Sawo Shop";

  // Whichever group holds the active page starts open; a staff member
  // landing on /reviews should see the Catalog group already expanded, not
  // have to guess which one to click first.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.label, g.items.some((item) => isActive(pathname, item.href))]))
  );

  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) => g.items.some((item) => isActive(pathname, item.href)));
    if (activeGroup) setOpenGroups((prev) => ({ ...prev, [activeGroup.label]: true }));
  }, [pathname]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-white">
      <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-5">
        {settings?.logoUrl ? (
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logoUrl} alt={storeName} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink-900 text-sm font-bold text-white">
            {storeName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{storeName}</p>
          <p className="truncate text-xs text-ink-500">
            {user?.name ?? "..."} ({ROLE_LABELS[user?.role ?? "FULFILLMENT_STAFF"]})
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink item={{ href: "/dashboard", label: "Dashboard", icon: DashboardIcon }} active={isActive(pathname, "/dashboard")} />

        {NAV_GROUPS.map((group) => {
          const open = openGroups[group.label];
          return (
            <div key={group.label} className="pt-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400 hover:text-ink-600"
              >
                {group.label}
                <ChevronIcon className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
              </button>
              {open && (
                <div className="mt-0.5 space-y-1">
                  {group.items
                    .filter((item) => !item.adminOnly || user?.role === "ADMIN")
                    .map((item) => (
                      <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
                    ))}
                </div>
              )}
            </div>
          );
        })}

        {user?.role === "ADMIN" && (
          <div className="pt-1">
            <NavLink item={{ href: "/configuration", label: "Configuration", icon: ConfigIcon }} active={isActive(pathname, "/configuration")} />
          </div>
        )}
      </nav>
    </aside>
  );
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="3" width="6" height="6" rx="1.2" />
      <rect x="11" y="3" width="6" height="6" rx="1.2" />
      <rect x="3" y="11" width="6" height="6" rx="1.2" />
      <rect x="11" y="11" width="6" height="6" rx="1.2" />
    </svg>
  );
}

function OrdersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 4h12l-1 10.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5 14.5L4 4Z" />
      <path d="M7 4V3a3 3 0 0 1 6 0v1" />
    </svg>
  );
}

function CatalogIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M3 8h14" />
    </svg>
  );
}

function InventoryIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 6l6-3 6 3-6 3-6-3z" />
      <path d="M4 6v8l6 3 6-3V6" />
      <path d="M10 9v8" />
    </svg>
  );
}

function CustomersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c0-3 2.7-5 6-5s6 2 6 5" />
    </svg>
  );
}

function ShippingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 7h9v7H3z" />
      <path d="M12 10h3l2 2v2h-5z" />
      <circle cx="6" cy="16" r="1.4" />
      <circle cx="14" cy="16" r="1.4" />
    </svg>
  );
}

function PaymentsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="5" width="14" height="10" rx="1.5" />
      <path d="M3 8.5h14" />
    </svg>
  );
}

function CouponsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 8.5a1.5 1.5 0 0 0 0 3V13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.5a1.5 1.5 0 0 1 0-3V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v2.5Z" />
      <path d="M8 5v10" strokeDasharray="1.6 1.6" />
    </svg>
  );
}

function ReviewsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M10 3.5l1.8 3.7 4 .6-2.9 2.9.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.9 4-.6L10 3.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function StaffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="7" cy="7" r="2.6" />
      <path d="M2.5 16c0-2.8 2-4.6 4.5-4.6s4.5 1.8 4.5 4.6" />
      <circle cx="14.5" cy="6.5" r="2" />
      <path d="M12.5 11.6c2.2.2 3.8 1.9 3.8 4.4" />
    </svg>
  );
}

function ConfigIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.3 5.3l1.4 1.4M13.3 13.3l1.4 1.4M14.7 5.3l-1.4 1.4M6.7 13.3l-1.4 1.4" />
    </svg>
  );
}
