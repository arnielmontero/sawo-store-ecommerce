"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoreSettings } from "@/lib/store-settings-context";
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/orders", label: "Orders", icon: OrdersIcon },
  { href: "/catalog", label: "Catalog", icon: CatalogIcon },
  { href: "/inventory", label: "Inventory", icon: InventoryIcon },
  { href: "/customers", label: "Customers", icon: CustomersIcon },
  { href: "/deliveries", label: "Deliveries", icon: ShippingIcon },
  { href: "/payments", label: "Payments", icon: PaymentsIcon },
  { href: "/configuration", label: "Configuration", icon: ConfigIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { settings } = useStoreSettings();
  const { user } = useAuth();
  const storeName = settings?.storeName ?? "Sawo Shop";

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
            {user?.name ?? "..."} ({user?.role === "ADMIN" ? "Admin" : "Staff"})
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand-50 text-brand-600"
                  : "text-ink-700 hover:bg-gray-50 hover:text-ink-900"
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? "text-brand-600" : "text-ink-500"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-100 px-5 py-4">
        <div className="flex items-center justify-between text-xs text-ink-500">
          <span>Storage usage</span>
          <span>25%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full w-1/4 rounded-full bg-brand-500" />
        </div>
      </div>
    </aside>
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

function ConfigIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.3 5.3l1.4 1.4M13.3 13.3l1.4 1.4M14.7 5.3l-1.4 1.4M6.7 13.3l-1.4 1.4" />
    </svg>
  );
}
