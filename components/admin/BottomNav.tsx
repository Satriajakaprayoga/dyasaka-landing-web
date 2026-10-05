"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, DashboardIcon, LayersIcon, PackageIcon } from "./icons";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: DashboardIcon },
  { href: "/admin/products", label: "Produk", icon: PackageIcon },
  { href: "/admin/items", label: "Inventori", icon: LayersIcon },
  { href: "/admin/bookings", label: "Booking", icon: CalendarIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white lg:hidden pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition ${
              isActive(item.href)
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
