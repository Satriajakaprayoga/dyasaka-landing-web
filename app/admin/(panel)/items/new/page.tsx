"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ItemForm from "@/components/admin/ItemForm";

export default function NewItemPage() {
  const [itemCategories, setItemCategories] = useState<
    { name: string; count: number }[]
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
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tambah Item</h1>
        <p className="mt-1 text-sm text-gray-500">
          Komponen dasar penyusun paket — habis pakai atau sewa
        </p>
      </div>

      <ItemForm itemCategories={itemCategories} />
    </div>
  );
}
