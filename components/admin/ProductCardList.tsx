"use client";

import { useState } from "react";
import type { ProductRow } from "./useInfiniteProducts";
import { Badge, Skeleton, formatRupiah } from "./ui";
import { PackageIcon, PencilIcon, TrashIcon } from "./icons";

type RecipeDetailRow = {
  id: string;
  quantity: number;
  is_included: boolean;
  is_show_public: boolean;
  item_variants: {
    color: string | null;
    size: string | null;
    items: { name: string } | null;
  } | null;
};

function recipeTitle(row: RecipeDetailRow) {
  const v = row.item_variants;
  const name = v?.items?.name ?? "Varian";
  const details = [v?.color, v?.size].filter(Boolean).join(", ");
  return details ? `${name} (${details})` : name;
}

/**
 * Collapsible "Isi Paket" preview inside a product card — same
 * details/summary pattern as the inventory variant history. Lazy:
 * the recipe is fetched from GET /api/admin/product-items the first
 * time the card expands, then cached in state for re-expands (fresh
 * data on the next page render).
 */
function ProductRecipeDetails({ productId }: { productId: string }) {
  const [rows, setRows] = useState<RecipeDetailRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (rows || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/product-items?product_id=${productId}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Gagal memuat isi paket (HTTP ${res.status})`);
      } else {
        const body = await res.json();
        setRows(body.items ?? []);
      }
    } catch {
      setError("Gagal memuat isi paket");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details
      className="mt-3 border-t border-gray-100 pt-3"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) load();
      }}
    >
      <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-900">
        Isi Paket{rows ? ` (${rows.length} item)` : ""}
      </summary>
      <div className="mt-3">
        {loading && (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {rows && rows.length === 0 && (
          <p className="text-xs text-gray-400">Belum ada item dalam paket.</p>
        )}
        {rows && rows.length > 0 && (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="min-w-0 truncate text-gray-600">
                  <span className="font-medium tabular-nums text-gray-900">
                    {r.quantity}&times;
                  </span>{" "}
                  {recipeTitle(r)}
                </span>
                <span className="flex shrink-0 gap-1">
                  <span
                    className={
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                      (r.is_included
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500")
                    }
                  >
                    {r.is_included ? "Termasuk" : "Add-on"}
                  </span>
                  <span
                    className={
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                      (r.is_show_public
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-500")
                    }
                  >
                    {r.is_show_public ? "Tampil" : "Sembunyi"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

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
            <div className="flex justify-between gap-3">
              <div className="flex items-start gap-3 ">
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
                <div>
                  {/* title */}
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                    {p.name}
                  </p>
                  {p.categories?.name && (
                    <span className="mt-2 self-start rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {p.categories.name}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <Badge tone={p.is_active ? "green" : "gray"}>
                  {p.is_active ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
            </div>

            {p.description && (
              <p className="mt-2 line-clamp-2 text-xs text-gray-400">
                {p.description}
              </p>
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

            <ProductRecipeDetails productId={p.id} />

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
