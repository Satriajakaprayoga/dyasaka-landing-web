"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ItemForm from "@/components/admin/ItemForm";
import { BackLink, Breadcrumbs } from "@/components/admin/ui";

export default function NewItemPage() {
  const [itemCategories, setItemCategories] = useState<
    { name: string; count: number }[]
  >([]);
  const [vendors, setVendors] = useState<
    { id: string; name: string; is_active: boolean }[]
  >([]);

  useEffect(() => {
    supabase.from("items").select("item_category").then(({ data }) => {
      const rows = (data ?? []) as { item_category: string }[];
      const counts = new Map<string, number>();
      for (const r of rows) {
        counts.set(r.item_category, (counts.get(r.item_category) ?? 0) + 1);
      }
      setItemCategories(
        [...counts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    });

    supabase
      .from("vendors")
      .select("id, name, is_active")
      .order("name")
      .then(({ data }) => setVendors(data ?? []));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Inventori", href: "/admin/items" },
              { label: "Tambah Item" },
            ]}
          />
          <BackLink href="/admin/items" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Tambah Item
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Komponen dasar penyusun paket — habis pakai, sewa, atau jasa
        </p>
      </div>

      <ItemForm itemCategories={itemCategories} vendors={vendors} />
    </div>
  );
}
