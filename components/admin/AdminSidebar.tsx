"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BottomNav from "./BottomNav";
import {
  CalendarIcon,
  DashboardIcon,
  ExternalLinkIcon,
  LayersIcon,
  LogOutIcon,
  PackageIcon,
  TagIcon,
  XIcon,
} from "./icons";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: DashboardIcon },
  { href: "/admin/products", label: "Produk", icon: PackageIcon },
  { href: "/admin/items", label: "Inventori", icon: LayersIcon },
  { href: "/admin/bookings", label: "Booking", icon: CalendarIcon },
  { href: "/admin/categories", label: "Kategori", icon: TagIcon },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function isActive(href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  }

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open (mobile only).
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      {/* Sidebar — static on desktop, slide-in drawer on mobile/tablet */}
      <aside
        aria-hidden={!drawerOpen}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-900 transition-transform duration-200 lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">
            🎈
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold leading-tight text-white">
              Dyasaka
            </p>
            <p className="text-xs text-gray-400">Panel Admin</p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Tutup menu"
            className="rounded-lg p-1 text-gray-400 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
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
            onClick={() => setDrawerOpen(false)}
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

      {/* Mobile top bar (brand + logout; navigation lives in BottomNav) */}
      <header className="sticky top-0 z-40 bg-gray-900 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
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
      </header>

      {/* Mobile/tablet bottom navigation */}
      <BottomNav
        onOpenOther={() => setDrawerOpen(true)}
        otherActive={drawerOpen}
      />

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-[2px] lg:hidden"
        />
      )}
    </>
  );
}
