"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ItemForm from "@/components/admin/ItemForm";

export default function NewItemPage() {
  const [itemCategories, setItemCategories] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("items").select("item_category").then(({ data }) => {
      const rows = (data ?? []) as { item_category: string }[];
      setItemCategories([...new Set(rows.map((r) => r.item_category))].sort());
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
