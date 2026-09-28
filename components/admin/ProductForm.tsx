"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Category, Product, ProductImage } from "@/lib/types";
import {
  Card,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from "./ui";
import { ImageIcon, PlusIcon } from "./icons";

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

function ExistingImage({
  image,
  onRemove,
}: {
  image: ProductImage;
  onRemove: () => void;
}) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.image_url}
        alt={`Foto produk ${image.sort_order + 1}`}
        className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Hapus foto"
        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-sm text-white transition hover:bg-gray-700"
      >
        &times;
      </button>
      <p className="mt-1 text-[10px] text-gray-400">tersimpan</p>
    </div>
  );
}

type Props = {
  categories: Category[];
  product?: Product & { product_images?: ProductImage[] };
};

export default function ProductForm({ categories, product }: Props) {
  const router = useRouter();
  const isEdit = Boolean(product);

  const [form, setForm] = useState({
    category_id: product?.category_id ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price) : "",
    is_active: product ? String(product.is_active) : "true",
  });
  const [existingImages, setExistingImages] = useState<ProductImage[]>(
    () =>
      [...(product?.product_images ?? [])].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  function removeExistingImage(id: string) {
    setExistingImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function deleteImage(image: ProductImage) {
    const path = image.image_url.split("/product-images/")[1];
    if (path) {
      await supabase.storage.from("product-images").remove([path]);
    }
    await supabase.from("product_images").delete().eq("id", image.id);
  }

  async function uploadImage(file: File, productId: string, sortOrder: number) {
    const path = `${productId}/${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file);

    if (uploadError) {
      setError(`Upload failed for ${file.name}: ${uploadError.message}`);
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from("product-images")
      .getPublicUrl(path);

    const { error: insertError } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        image_url: publicUrl.publicUrl,
        sort_order: sortOrder,
      });

    if (insertError) {
      setError(
        `Failed to save image record for ${file.name}: ${insertError.message}`,
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      category_id: form.category_id,
      name: form.name,
      description: form.description,
      price: Number(form.price),
      ...(isEdit ? { is_active: form.is_active === "true" } : {}),
    };

    // 1. Create or update the product record
    const res = await fetch("/api/admin/products", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: product!.id, ...payload } : payload),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to save product");
      setSubmitting(false);
      return;
    }

    const { product: saved } = await res.json();
    const productId: string = isEdit ? product!.id : saved.id;

    // 2. Delete removed existing images (storage + record)
    const removed = (product?.product_images ?? []).filter(
      (img) => !existingImages.some((cur) => cur.id === img.id),
    );
    for (const img of removed) {
      await deleteImage(img);
    }

    // 3. Upload new photos, continuing sort_order after existing images
    const base = existingImages.length;
    for (let i = 0; i < files.length; i++) {
      await uploadImage(files[i], productId, base + i);
    }

    setSubmitting(false);
    router.push("/admin/products");
    router.refresh();
  }

  return (
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

        <div className="grid gap-5 sm:grid-cols-2">
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
          {isEdit && (
            <div>
              <label className={labelClass}>Status</label>
              <select
                value={form.is_active}
                onChange={(e) => update("is_active", e.target.value)}
                className={inputClass}
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>
          )}
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
          {(existingImages.length > 0 || files.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-4">
              {existingImages.map((img) => (
                <ExistingImage
                  key={img.id}
                  image={img}
                  onRemove={() => removeExistingImage(img.id)}
                />
              ))}
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
            {submitting
              ? "Menyimpan…"
              : isEdit
                ? "Simpan Perubahan"
                : "Simpan Produk"}
          </button>
        </div>
      </form>
    </Card>
  );
}
