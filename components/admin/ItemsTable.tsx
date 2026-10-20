"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Item, ItemType, ItemVariant } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Badge, Card, EmptyState, inputClass } from "./ui";
import { usePersistentFilters } from "./usePersistentFilters";
import Pagination from "./Pagination";
import ConfirmModal, {
  ImpactBookingList,
  ImpactProductList,
  type ImpactBookingRef,
  type ImpactProductRef,
} from "./ConfirmModal";
import { LayersIcon, PencilIcon, TrashIcon } from "./icons";

type Row = Item & {
  item_variants: ItemVariant[];
};

type Impact = {
  blocked: boolean;
  lines: { text: string; danger: boolean }[];
  bookingRefs: ImpactBookingRef[];
  productRefs: ImpactProductRef[];
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
  const [confirmRow, setConfirmRow] = useState<Row | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [filters, setFilter, resetFilters] = usePersistentFilters<{
    q: string;
    type: string;
    low: boolean;
    page: number;
  }>("admin-items-filters", { q: "", type: "all", low: false, page: 1 });
  const query = filters.q as string;
  const typeFilter = filters.type as "all" | ItemType;
  const lowOnly = Boolean(filters.low);
  const page = filters.page;

  const filtered = rows.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (lowOnly && lowStockCount(item.item_variants) === 0) return false;

    const q = query.trim().toLowerCase();
    if (q) {
      const haystack = [
        item.name,
        item.item_category,
        ...item.item_variants.map((v) => [v.color, v.size, v.sku].filter(Boolean).join(" ")),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  function changePage(p: number) {
    setFilter({ page: p });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // items → item_variants is ON DELETE CASCADE, but each variant is
  // RESTRICT-referenced by four tables: price history, stock movements,
  // product recipes, and booking items — any of them blocks the delete.
  // Referencing bookings/products are fetched so the modal can link to
  // them for inspection before the admin decides.
  async function computeImpact(item: Row): Promise<Impact> {
    const variantIds = item.item_variants.map((v) => v.id);
    const lines: Impact["lines"] = [];

    if (variantIds.length === 0) {
      return {
        blocked: false,
        lines: [{ text: "Item tanpa varian — aman untuk dihapus.", danger: false }],
        bookingRefs: [],
        productRefs: [],
      };
    }

    const [priceHistory, movements, recipeRows, bookingItemRows] =
      await Promise.all([
        supabase
          .from("item_price_history")
          .select("id", { count: "exact", head: true })
          .in("item_variant_id", variantIds),
        supabase
          .from("stock_movements")
          .select("id", { count: "exact", head: true })
          .in("item_variant_id", variantIds),
        supabase
          .from("product_items")
          .select("product_id, products(id, name)")
          .in("item_variant_id", variantIds),
        supabase
          .from("booking_items")
          .select("booking_id, bookings(customer_name, event_date)")
          .in("item_variant_id", variantIds),
      ]);

    // Child→parent embeds come back as objects; dedupe by parent id.
    const productMap = new Map<string, string>();
    for (const row of (recipeRows.data ?? []) as unknown as {
      products: { id: string; name: string } | null;
    }[]) {
      if (row.products) productMap.set(row.products.id, row.products.name);
    }
    const productRefs: ImpactProductRef[] = [...productMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const bookingMap = new Map<string, { customer_name: string; event_date: string }>();
    for (const row of (bookingItemRows.data ?? []) as unknown as {
      booking_id: string;
      bookings: { customer_name: string; event_date: string } | null;
    }[]) {
      if (row.bookings) bookingMap.set(row.booking_id, row.bookings);
    }
    const bookingRefs: ImpactBookingRef[] = [...bookingMap.entries()]
      .map(([id, b]) => ({ id, ...b }))
      .sort((a, b) => a.event_date.localeCompare(b.event_date));

    const blockers: string[] = [];
    if ((movements.count ?? 0) > 0)
      blockers.push(`${movements.count} pergerakan stok`);
    if ((priceHistory.count ?? 0) > 0)
      blockers.push(`${priceHistory.count} riwayat harga`);
    if (productRefs.length > 0)
      blockers.push(`${(recipeRows.data ?? []).length} baris resep produk`);
    if ((bookingItemRows.data ?? []).length > 0)
      blockers.push(`${(bookingItemRows.data ?? []).length} item booking`);

    const blocked = blockers.length > 0;
    if (blocked) {
      lines.push({
        text: `Varian masih dipakai (${blockers.join(", ")}) — item tidak dapat dihapus.`,
        danger: true,
      });
    }
    lines.push({
      text: `${variantIds.length} varian (beserta stoknya) akan ikut terhapus.`,
      danger: false,
    });
    return { blocked, lines, bookingRefs, productRefs };
  }

  function closeConfirm() {
    setConfirmRow(null);
    setImpact(null);
  }

  async function handleDeleteClick(item: Row) {
    setConfirmRow(item);
    setImpact(null);
    setImpact(await computeImpact(item));
  }

  async function performDelete() {
    if (!confirmRow) return;

    setDeletingId(confirmRow.id);
    setError(null);

    const res = await fetch(`/api/admin/items?id=${confirmRow.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json();
      closeConfirm();
      setDeletingId(null);
      setError(body.error ?? "Gagal menghapus item");
      return;
    }

    closeConfirm();
    setDeletingId(null);
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <input
            type="search"
            placeholder="Cari nama, kategori, varian…"
            value={query}
            onChange={(e) => setFilter({ q: e.target.value, page: 1 })}
            className={inputClass}
          />
        </div>
        <div className="w-full sm:w-40">
          <select
            value={typeFilter}
            onChange={(e) => setFilter({ type: e.target.value, page: 1 })}
            className={inputClass}
            aria-label="Filter tipe item"
          >
            <option value="all">Semua Tipe</option>
            <option value="consumable">Habis Pakai</option>
            <option value="rentable">Sewa</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setFilter({ low: e.target.checked, page: 1 })}
            className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          Hanya stok rendah
        </label>
        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} dari {rows.length} item
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            title="Tidak ada item yang cocok"
            subtitle="Coba ubah kata kunci atau reset filter."
          >
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-medium text-gray-900 underline underline-offset-4"
            >
              Reset Filter
            </button>
          </EmptyState>
        </Card>
      ) : (
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
              {pageRows.map((item) => {
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
                          onClick={() => handleDeleteClick(item)}
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
      )}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={changePage}
      />

      <ConfirmModal
        open={confirmRow !== null}
        title={confirmRow ? `Hapus item "${confirmRow.name}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={deletingId !== null}
        disabled={impact?.blocked ?? false}
        onConfirm={performDelete}
        onClose={closeConfirm}
      >
        {!impact ? (
          <p className="text-gray-500">Memeriksa relasi data…</p>
        ) : (
          <>
            {impact.lines.map((line, i) => (
              <p
                key={i}
                className={
                  line.danger
                    ? "font-medium text-red-600"
                    : "text-gray-600"
                }
              >
                {line.text}
              </p>
            ))}
            {impact.bookingRefs.length > 0 && (
              <>
                <p className="pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Dipakai di booking — klik untuk memeriksa
                </p>
                <ImpactBookingList bookings={impact.bookingRefs} />
              </>
            )}
            {impact.productRefs.length > 0 && (
              <>
                <p className="pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Dipakai di resep produk — klik untuk memeriksa
                </p>
                <ImpactProductList products={impact.productRefs} />
              </>
            )}
          </>
        )}
      </ConfirmModal>
    </div>
  );
}
