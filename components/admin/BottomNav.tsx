"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  DashboardIcon,
  DotsIcon,
  LayersIcon,
  PackageIcon,
} from "./icons";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: DashboardIcon },
  { href: "/admin/products", label: "Produk", icon: PackageIcon },
  { href: "/admin/items", label: "Inventori", icon: LayersIcon },
  { href: "/admin/bookings", label: "Booking", icon: CalendarIcon },
];

type Props = {
  onOpenOther: () => void;
  otherActive: boolean;
};

export default function BottomNav({ onOpenOther, otherActive }: Props) {
  const pathname = usePathname();

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="grid grid-cols-5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-medium transition active:scale-95 ${
              isActive(item.href)
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={onOpenOther}
          aria-expanded={otherActive}
          className={`flex flex-col items-center gap-0.5 px-1 py-2.5 text-[11px] font-medium transition active:scale-95 ${
            otherActive
              ? "text-gray-900"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <DotsIcon className="h-5 w-5" />
          Lainnya
        </button>
      </div>
    </nav>
  );
}
