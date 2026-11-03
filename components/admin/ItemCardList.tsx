"use client";

import Link from "next/link";
import { lowStockCount, type ItemRow } from "./ItemsTable";
import { Badge, Skeleton } from "./ui";
import { LayersIcon, PencilIcon, TrashIcon } from "./icons";

type Props = {
  items: ItemRow[];
  deletingId: string | null;
  /** True while the next infinite-scroll batch is being fetched. */
  loadingMore?: boolean;
  onDelete: (item: ItemRow) => void;
};

// Card view — the phone default (1 column) and the desktop/tablet
// alternative via the view toggle (2–3 columns). Presentation only:
// data, filters and the delete flow live in ItemsView.
export default function ItemCardList({
  items,
  deletingId,
  loadingMore = false,
  onDelete,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const low = lowStockCount(item.item_variants);
        return (
          <div
            key={item.id}
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/items/${item.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 hover:underline underline-offset-2"
              >
                {item.name}
              </Link>
              <Badge tone={item.type === "rentable" ? "amber" : "blue"}>
                {item.type === "rentable" ? "Sewa" : "Habis Pakai"}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {item.item_category}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {item.item_variants.length} varian
              </span>
              {low > 0 && <Badge tone="red">{low} stok rendah</Badge>}
            </div>

            {item.type === "rentable" && (
              <p className="mt-2 text-xs text-gray-400">
                Dimiliki: {item.quantity_owned} unit
              </p>
            )}

            {/* mt-auto pins actions to the bottom so grid rows stretch
                to equal heights. */}
            <div className="mt-auto pt-3">
              <div className="flex gap-2 border-t border-gray-100 pt-3 md:justify-end">
                <Link
                  href={`/admin/items/${item.id}`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 md:min-h-0 md:flex-none md:border-0 md:px-2.5 md:py-1.5"
                >
                  <LayersIcon className="h-3.5 w-3.5" />
                  Varian
                </Link>
                <Link
                  href={`/admin/items/${item.id}/edit`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 md:min-h-0 md:flex-none md:border-0 md:px-2.5 md:py-1.5"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                  Ubah
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  disabled={deletingId === item.id}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 md:min-h-0 md:flex-none md:border-0 md:px-2.5 md:py-1.5"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  {deletingId === item.id ? "…" : "Hapus"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {loadingMore &&
        Array.from({ length: 3 }).map((_, i) => (
          <ItemCardSkeleton key={`loading-${i}`} />
        ))}
    </div>
  );
}

function ItemCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 min-w-0 flex-1" />
        <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
      </div>
      <div className="mt-2 flex gap-1.5">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3 md:justify-end">
        <Skeleton className="h-11 flex-1 rounded-lg md:h-9 md:w-24" />
        <Skeleton className="h-11 flex-1 rounded-lg md:h-9 md:w-24" />
        <Skeleton className="h-11 flex-1 rounded-lg md:h-9 md:w-24" />
      </div>
    </div>
  );
}
