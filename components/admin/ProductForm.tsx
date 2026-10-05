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

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_MB = 10;
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SKIP_COMPRESSION_BYTES = 300 * 1024;

/**
 * Shrink large photos before they leave the browser: downscale to
 * MAX_DIMENSION on the long edge and re-encode as JPEG. Small files and
 * files the browser cannot decode are returned untouched.
 */
async function compressImage(file: File): Promise<File> {
  if (file.size <= SKIP_COMPRESSION_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // undecodable in this browser — upload the original
  }

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  // Flatten transparency onto white so JPEG output has no black background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  const name = `${file.name.replace(/\.[^.]+$/, "")}.jpg`;
  return new File([blob], name, { type: "image/jpeg" });
}

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
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        rejected.push(`${file.name} (bukan JPG/PNG/WebP)`);
      } else if (file.size > MAX_FILE_MB * 1024 * 1024) {
        rejected.push(`${file.name} (melebihi ${MAX_FILE_MB}MB)`);
      } else {
        accepted.push(file);
      }
    }
    setFiles((prev) => [...prev, ...accepted]);
    if (rejected.length > 0) {
      setError(`File ditolak: ${rejected.join(", ")}`);
    }
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

  async function uploadImage(
    file: File,
    productId: string,
    sortOrder: number,
  ): Promise<{ ok: boolean; message?: string }> {
    try {
      const compressed = await compressImage(file);
      const ext =
        compressed.type === "image/png"
          ? "png"
          : compressed.type === "image/webp"
            ? "webp"
            : "jpg";
      const base =
        compressed.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^\w-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "foto";
      const path = `${productId}/${Date.now()}-${sortOrder}-${base}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, compressed);
      if (uploadError) return { ok: false, message: uploadError.message };

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
        // Don't leave orphan files in storage when the record insert fails
        await supabase.storage.from("product-images").remove([path]);
        return { ok: false, message: insertError.message };
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "kesalahan tidak diketahui",
      };
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

    // 3. Renumber kept images so sort_order stays contiguous 0..n-1
    //    (removals leave gaps; new uploads must not collide)
    for (let i = 0; i < existingImages.length; i++) {
      const img = existingImages[i];
      if (img.sort_order === i) continue;
      const { error } = await supabase
        .from("product_images")
        .update({ sort_order: i })
        .eq("id", img.id);
      if (error) {
        setError(`Gagal memperbarui urutan foto: ${error.message}`);
        setSubmitting(false);
        return;
      }
    }

    // 4. Upload new photos, collecting failures instead of swallowing them
    const base = existingImages.length;
    const failures: string[] = [];
    const failedFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const result = await uploadImage(files[i], productId, base + i);
      if (result.ok) continue;
      failures.push(`• ${files[i].name}: ${result.message}`);
      failedFiles.push(files[i]);
    }

    if (failures.length > 0) {
      // Stay on the page with the failed files still selected so the user
      // can retry without re-picking them.
      setFiles(failedFiles);
      setError(
        `Beberapa foto gagal disimpan — produk sudah tersimpan. Cek lalu simpan lagi.\n${failures.join("\n")}`,
      );
      setSubmitting(false);
      return;
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
              JPG/PNG/WebP · maks {MAX_FILE_MB}MB · dikompres otomatis · bisa
              pilih beberapa
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
          <p className="whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
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
