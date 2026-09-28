"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";
import ProductForm from "@/components/admin/ProductForm";

export default function NewProductPage() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => setCategories((data ?? []) as Category[]));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tambah Produk</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tambahkan dekorasi baru ke katalog
        </p>
      </div>

      <ProductForm categories={categories} />
    </div>
  );
}
