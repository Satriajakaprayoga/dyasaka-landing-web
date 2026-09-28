"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category, Product, ProductImage } from "@/lib/types";
import { Badge, Card, EmptyState } from "./ui";
import { PackageIcon, PencilIcon, TrashIcon } from "./icons";

type Row = Product & {
  categories: Pick<Category, "name">;
  product_images: Pick<ProductImage, "image_url" | "sort_order">[];
};

export default function ProductsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(p: Row) {
    if (
      !confirm(
        `Hapus produk "${p.name}"? Semua foto produk juga akan dihapus.`,
      )
    )
      return;

    setDeletingId(p.id);
    setError(null);

    const res = await fetch(`/api/admin/products?id=${p.id}`, {
      method: "DELETE",
    });
    setDeletingId(null);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal menghapus produk");
      return;
    }

    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <Card className="overflow-hidden">
        <EmptyState
          title="Belum ada produk"
          subtitle="Tambahkan produk pertama untuk melengkapi katalog."
        >
          <Link href="/admin/products/new" className="text-sm font-medium text-gray-900 underline underline-offset-4">
            Tambah Produk
          </Link>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Produk</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Harga</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((p) => {
                const cover = [...(p.product_images ?? [])].sort(
                  (a, b) => a.sort_order - b.sort_order,
                )[0];
                return (
                  <tr key={p.id} className="transition hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover.image_url}
                            alt={p.name}
                            className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                            <PackageIcon className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {p.name}
                          </p>
                          {p.description && (
                            <p className="max-w-xs truncate text-xs text-gray-400">
                              {p.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.categories?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-gray-900">
                      Rp {p.price.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={p.is_active ? "green" : "gray"}>
                        {p.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Ubah
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          disabled={deletingId === p.id}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {deletingId === p.id ? "Menghapus…" : "Hapus"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
