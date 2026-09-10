"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    category_id: "",
    name: "",
    description: "",
    price: "",
  });
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .then(({ data }) => setCategories((data ?? []) as Category[]));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // 1. Create the product record
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: Number(form.price) }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to create product");
      setSubmitting(false);
      return;
    }

    const { product } = await res.json();

    // 2. Upload photos directly to Supabase Storage (client-side,
    // since Storage uses the authenticated admin session already).
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `${product.id}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, file);

        if (uploadError) {
          setError(`Upload failed for ${file.name}: ${uploadError.message}`);
          continue;
        }

        const { data: publicUrl } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);

        const { error: insertError } = await supabase
          .from("product_images")
          .insert({
            product_id: product.id,
            image_url: publicUrl.publicUrl,
            sort_order: i,
          });

        if (insertError) {
          setError(
            `Failed to save image record for ${file.name}: ${insertError.message}`,
          );
          continue;
        }
      }
    }

    setSubmitting(false);
    router.push("/admin/products");
    router.refresh();
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">Tambah Produk</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Kategori</label>
          <select
            required
            value={form.category_id}
            onChange={(e) => update("category_id", e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Pilih kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nama Produk</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Deskripsi</label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Harga (Rp)</label>
          <input
            type="number"
            required
            value={form.price}
            onChange={(e) => update("price", e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Foto Produk</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-pink-600 text-white rounded px-4 py-2 font-medium hover:bg-pink-700 transition disabled:opacity-50"
        >
          {submitting ? "Menyimpan…" : "Simpan Produk"}
        </button>
      </form>
    </main>
  );
}
