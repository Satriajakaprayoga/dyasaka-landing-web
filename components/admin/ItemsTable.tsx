"use client";

import Link from "next/link";
import type { Item, ItemVariant } from "@/lib/types";
import { Badge, Card, Skeleton } from "./ui";
import { LayersIcon, PencilIcon, TrashIcon } from "./icons";

export type ItemRow = Item & {
  item_variants: ItemVariant[];
};

export function lowStockCount(variants: ItemVariant[]) {
  return variants.filter(
    (v) => v.reorder_point != null && v.stock_quantity <= v.reorder_point,
  ).length;
}

type Props = {
  items: ItemRow[];
  deletingId: string | null;
  /** True while the next infinite-scroll batch is being fetched. */
  loadingMore?: boolean;
  onDelete: (item: ItemRow) => void;
};

// Desktop/tablet table view — presentation only. Data, filters and the
// delete flow live in ItemsView.
export default function ItemsTable({
  items,
  deletingId,
  loadingMore = false,
  onDelete,
}: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Item
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Kategori
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Tipe
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Varian
              </th>
              {/* Fixed min-width so Varian/Ubah/Hapus never clip. */}
              <th className="sticky top-0 z-10 min-w-[13rem] bg-gray-50 px-4 py-3 text-right font-medium">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
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
                        onClick={() => onDelete(item)}
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
            {loadingMore &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`loading-${i}`} aria-hidden="true">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
                      <Skeleton className="hidden h-4 w-20 md:block" />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
