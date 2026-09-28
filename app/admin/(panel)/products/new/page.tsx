"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";
import {
  Card,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { ImageIcon, PlusIcon } from "@/components/admin/icons";

function FilePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="relative">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={file.name}
          className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
        />
      ) : (
        <div className="h-20 w-20 animate-pulse rounded-lg bg-gray-100" />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Hapus ${file.name}`}
        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-sm text-white transition hover:bg-gray-700"
      >
        &times;
      </button>
      <p className="mt-1 max-w-20 truncate text-[10px] text-gray-400">
        {file.name}
      </p>
    </div>
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    category_id: "",
    name: "",
    description: "",
    price: "",
  });
  const [files, setFiles] = useState<File[]>([]);
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

  function addFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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
    if (files.length > 0) {
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
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Tambah Produk</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tambahkan dekorasi baru ke katalog
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Kategori</label>
            <select
              required
              value={form.category_id}
              onChange={(e) => update("category_id", e.target.value)}
              className={inputClass}
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
            <label className={labelClass}>Nama Produk</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Deskripsi</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className={inputClass}
              rows={3}
            />
          </div>

          <div>
            <label className={labelClass}>Harga (Rp)</label>
            <input
              type="number"
              required
              min={0}
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Foto Produk</label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-4 py-6 text-center transition hover:border-gray-400 hover:bg-gray-50">
              <ImageIcon className="h-6 w-6 text-gray-400" />
              <span className="text-sm text-gray-600">
                Klik untuk pilih foto
              </span>
              <span className="text-xs text-gray-400">
                JPG/PNG/WebP · bisa pilih beberapa
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={addFiles}
              />
            </label>
            {files.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-4">
                {files.map((file, i) => (
                  <FilePreview
                    key={`${file.name}-${i}`}
                    file={file}
                    onRemove={() => removeFile(i)}
                  />
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={() => router.push("/admin/products")}
              className={btnSecondary}
            >
              Batal
            </button>
            <button type="submit" disabled={submitting} className={btnPrimary}>
              <PlusIcon className="h-4 w-4" />
              {submitting ? "Menyimpan…" : "Simpan Produk"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
