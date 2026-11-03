"use client";

import type { ProductRow } from "./useInfiniteProducts";
import { Badge, Card, Skeleton, formatRupiah } from "./ui";
import { PackageIcon, PencilIcon, TrashIcon } from "./icons";

type Props = {
  items: ProductRow[];
  deletingId: string | null;
  /** True while the next infinite-scroll batch is being fetched. */
  loadingMore?: boolean;
  onEdit: (p: ProductRow) => void;
  onDelete: (p: ProductRow) => void;
};

// Desktop/tablet table view — presentation only. Data, filters and the
// delete flow live in ProductsView (useInfiniteProducts + ConfirmModal).
export default function ProductsTable({
  items,
  deletingId,
  loadingMore = false,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Produk
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Kategori
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Harga
              </th>
              <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 font-medium">
                Status
              </th>
              {/* Fixed min-width so Ubah/Hapus never clip on narrow viewports. */}
              <th className="sticky top-0 z-10 min-w-[11rem] bg-gray-50 px-4 py-3 text-right font-medium">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((p) => {
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
                    {formatRupiah(p.price)}
                    {p.vendor_price != null && (
                      <span className="block text-xs font-normal text-gray-400">
                        vendor {formatRupiah(Number(p.vendor_price))} · margin{" "}
                        {formatRupiah(p.price - Number(p.vendor_price))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={p.is_active ? "green" : "gray"}>
                      {p.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                        Ubah
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(p)}
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
            {loadingMore &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={`loading-${i}`} aria-hidden="true">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="hidden h-4 w-24 sm:block" />
                      <Skeleton className="hidden h-4 w-16 md:block" />
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
