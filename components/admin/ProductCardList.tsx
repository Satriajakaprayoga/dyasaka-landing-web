"use client";

import type { ProductRow } from "./useInfiniteProducts";
import { Badge, Skeleton, formatRupiah } from "./ui";
import { PackageIcon, PencilIcon, TrashIcon } from "./icons";

type Props = {
  items: ProductRow[];
  deletingId: string | null;
  /** True while the next infinite-scroll batch is being fetched. */
  loadingMore?: boolean;
  onEdit: (p: ProductRow) => void;
  onDelete: (p: ProductRow) => void;
};

// Card view — the phone default (1 column) and the desktop/tablet
// alternative via the view toggle (2–3 columns). Presentation only:
// data, filters and the delete flow live in ProductsView.
export default function ProductCardList({
  items,
  deletingId,
  loadingMore = false,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => {
        const cover = [...(p.product_images ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        )[0];
        return (
          <div
            key={p.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
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
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">
                {p.name}
              </p>
              <Badge tone={p.is_active ? "green" : "gray"}>
                {p.is_active ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>

            {p.description && (
              <p className="mt-2 line-clamp-2 text-xs text-gray-400">
                {p.description}
              </p>
            )}

            {p.categories?.name && (
              <span className="mt-2 self-start rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {p.categories.name}
              </span>
            )}

            <div className="mt-3">
              <p className="text-base font-semibold tabular-nums text-gray-900">
                {formatRupiah(p.price)}
              </p>
              {p.vendor_price != null && (
                <p className="mt-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500">
                  Vendor {formatRupiah(Number(p.vendor_price))} · Margin{" "}
                  {formatRupiah(p.price - Number(p.vendor_price))}
                </p>
              )}
            </div>

            {/* mt-auto pins actions to the bottom so grid rows stretch
                to equal heights even when the vendor strip is absent. */}
            <div className="mt-auto pt-3">
              <div className="flex gap-2 border-t border-gray-100 pt-3 md:justify-end">
                <button
                  type="button"
                  onClick={() => onEdit(p)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 md:min-h-0 md:flex-none"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                  Ubah
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  disabled={deletingId === p.id}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 md:min-h-0 md:flex-none"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  {deletingId === p.id ? "Menghapus…" : "Hapus"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {loadingMore &&
        Array.from({ length: 3 }).map((_, i) => (
          <ProductCardSkeleton key={`loading-${i}`} />
        ))}
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        <Skeleton className="h-4 min-w-0 flex-1" />
        <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-3 w-4/5" />
      <Skeleton className="mt-2 h-5 w-20 rounded-full" />
      <Skeleton className="mt-3 h-5 w-28" />
      <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3 md:justify-end">
        <Skeleton className="h-11 flex-1 rounded-lg md:h-9 md:w-24" />
        <Skeleton className="h-11 flex-1 rounded-lg md:h-9 md:w-24" />
      </div>
    </div>
  );
}
