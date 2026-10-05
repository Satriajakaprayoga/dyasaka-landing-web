"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Item, ItemVariant } from "@/lib/types";
import { Badge, Card, EmptyState } from "./ui";
import { LayersIcon, PencilIcon, TrashIcon } from "./icons";

type Row = Item & {
  item_variants: ItemVariant[];
};

export function lowStockCount(variants: ItemVariant[]) {
  return variants.filter(
    (v) => v.reorder_point != null && v.stock_quantity <= v.reorder_point,
  ).length;
}

export default function ItemsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(item: Row) {
    if (
      !confirm(
        `Hapus item "${item.name}"? Semua variannya juga akan dihapus (gagal jika masih dipakai resep produk atau booking).`,
      )
    )
      return;

    setDeletingId(item.id);
    setError(null);

    const res = await fetch(`/api/admin/items?id=${item.id}`, {
      method: "DELETE",
    });
    setDeletingId(null);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal menghapus item");
      return;
    }

    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <Card className="overflow-hidden">
        <EmptyState
          title="Belum ada item"
          subtitle="Item adalah komponen penyusun paket — balon, stand, dll."
        >
          <Link href="/admin/items/new" className="text-sm font-medium text-gray-900 underline underline-offset-4">
            Tambah Item
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
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Tipe</th>
                <th className="px-4 py-3 font-medium">Varian</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((item) => {
                const low = lowStockCount(item.item_variants);
                return (
                  <tr key={item.id} className="transition hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/items/${item.id}`}
                        className="font-medium text-gray-900 hover:underline underline-offset-4"
                      >
                        {item.name}
                      </Link>
                      {item.type === "rentable" && (
                        <p className="text-xs text-gray-400">
                          Dimiliki: {item.quantity_owned} unit
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.item_category}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={item.type === "rentable" ? "amber" : "blue"}>
                        {item.type === "rentable" ? "Sewa" : "Habis Pakai"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">
                        {item.item_variants.length} varian
                      </span>
                      {low > 0 && (
                        <span className="ml-2">
                          <Badge tone="red">{low} stok rendah</Badge>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/admin/items/${item.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                          <LayersIcon className="h-3.5 w-3.5" />
                          Varian
                        </Link>
                        <Link
                          href={`/admin/items/${item.id}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Ubah
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {deletingId === item.id ? "…" : "Hapus"}
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
