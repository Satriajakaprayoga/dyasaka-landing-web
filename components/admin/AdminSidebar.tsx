"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CalendarIcon,
  DashboardIcon,
  ExternalLinkIcon,
  LogOutIcon,
  PackageIcon,
  TagIcon,
} from "./icons";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: DashboardIcon },
  { href: "/admin/products", label: "Produk", icon: PackageIcon },
  { href: "/admin/bookings", label: "Booking", icon: CalendarIcon },
  { href: "/admin/categories", label: "Kategori", icon: TagIcon },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-gray-900 lg:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">
            🎈
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-white">
              Dyasaka
            </p>
            <p className="text-xs text-gray-400">Panel Admin</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800/60 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/10 px-3 py-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-gray-800/60 hover:text-white"
          >
            <ExternalLinkIcon className="h-4 w-4 shrink-0" />
            Lihat Situs
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-gray-800/60 hover:text-white"
          >
            <LogOutIcon className="h-4 w-4 shrink-0" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 bg-gray-900 lg:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎈</span>
            <span className="text-sm font-semibold text-white">
              Dyasaka Admin
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Keluar"
            className="p-1 text-gray-400 transition hover:text-white"
          >
            <LogOutIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
