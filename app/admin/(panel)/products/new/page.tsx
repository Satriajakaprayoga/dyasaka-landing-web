"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Category, Vendor } from "@/lib/types";
import ProductForm from "@/components/admin/ProductForm";
import { BackLink, Breadcrumbs } from "@/components/admin/ui";

export default function NewProductPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => setCategories((data ?? []) as Category[]));
    supabase
      .from("vendors")
      .select("*")
      .order("name")
      .then(({ data }) => setVendors((data ?? []) as Vendor[]));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Produk", href: "/admin/products" },
              { label: "Tambah Produk" },
            ]}
          />
          <BackLink href="/admin/products" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Tambah Produk
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Tambahkan dekorasi baru ke katalog
        </p>
      </div>

      <ProductForm categories={categories} vendors={vendors} />
    </div>
  );
}
