"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category, Product, ProductImage } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { Badge, Card, EmptyState, formatDate, inputClass } from "./ui";
import { usePersistentFilters } from "./usePersistentFilters";
import Pagination from "./Pagination";
import ConfirmModal, {
  ImpactBookingList,
  type ImpactBookingRef,
} from "./ConfirmModal";
import { PackageIcon, PencilIcon, TrashIcon } from "./icons";

type Row = Product & {
  categories: Pick<Category, "name">;
  product_images: Pick<ProductImage, "image_url" | "sort_order">[];
};

type Impact = {
  blocked: boolean;
  lines: { text: string; danger: boolean }[];
  bookings: ImpactBookingRef[];
};

const statusFilterOptions = [
  { value: "all", label: "Semua Status" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
] as const;

export default function ProductsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRow, setConfirmRow] = useState<Row | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [filters, setFilter, resetFilters] = usePersistentFilters<{
    q: string;
    cat: string;
    status: string;
    page: number;
  }>("admin-products-filters", { q: "", cat: "all", status: "all", page: 1 });
  const query = filters.q as string;
  const categoryFilter = filters.cat as string;
  const statusFilter = filters.status as "all" | "active" | "inactive";
  const page = filters.page;

  const categoryNames = [
    ...new Set(rows.map((p) => p.categories?.name).filter(Boolean)),
  ].sort() as string[];

  const filtered = rows.filter((p) => {
    if (categoryFilter !== "all" && p.categories?.name !== categoryFilter)
      return false;
    if (statusFilter === "active" && !p.is_active) return false;
    if (statusFilter === "inactive" && p.is_active) return false;

    const q = query.trim().toLowerCase();
    if (q) {
      const haystack = [p.name, p.description ?? "", p.categories?.name ?? ""]
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

  function closeConfirm() {
    setConfirmRow(null);
    setImpact(null);
  }

  // bookings.product_id keeps its RESTRICT FK, but the BEFORE DELETE
  // trigger (20261020140000) cancels active bookings and unlinks the
  // rest before the constraint is checked — so deletion proceeds and
  // the modal lists the affected bookings as links to inspect first.
  // Photos + recipe rows cascade (storage files removed by the API).
  async function computeImpact(p: Row): Promise<Impact> {
    const [bookingsRes, images, recipe] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, customer_name, event_date, status")
        .eq("product_id", p.id)
        .order("event_date"),
      supabase
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .eq("product_id", p.id),
      supabase
        .from("product_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", p.id),
    ]);

    const bookings = (bookingsRes.data ?? []) as unknown as ImpactBookingRef[];
    const activeFirst = [...bookings].sort((a, b) => {
      const aActive = a.status === "pending" || a.status === "confirmed" ? 0 : 1;
      const bActive = b.status === "pending" || b.status === "confirmed" ? 0 : 1;
      return aActive - bActive;
    });

    const activeCount = bookings.filter(
      (b) => b.status === "pending" || b.status === "confirmed",
    ).length;
    const finishedCount = bookings.length - activeCount;

    const lines: Impact["lines"] = [];
    if (activeCount > 0) {
      lines.push({
        text: `${activeCount} booking aktif (pending/confirmed) akan dibatalkan.`,
        danger: true,
      });
    }
    if (finishedCount > 0) {
      lines.push({
        text: `${finishedCount} booking selesai/batal tetap tersimpan, hanya lepas dari produk ini.`,
        danger: false,
      });
    }
    if ((images.count ?? 0) > 0) {
      lines.push({
        text: `${images.count} foto produk (beserta filenya di storage) akan ikut terhapus.`,
        danger: false,
      });
    }
    if ((recipe.count ?? 0) > 0) {
      lines.push({
        text: `${recipe.count} baris Isi Paket (resep) akan ikut terhapus.`,
        danger: false,
      });
    }
    if (lines.length === 0) {
      lines.push({ text: "Tidak ada data terkait — aman untuk dihapus.", danger: false });
    }
    return { blocked: false, lines, bookings: activeFirst };
  }

  async function handleDeleteClick(p: Row) {
    setConfirmRow(p);
    setImpact(null);
    setImpact(await computeImpact(p));
  }

  async function performDelete() {
    if (!confirmRow) return;

    setDeletingId(confirmRow.id);
    setError(null);

    const res = await fetch(`/api/admin/products?id=${confirmRow.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json();
      closeConfirm();
      setDeletingId(null);
      setError(body.error ?? "Gagal menghapus produk");
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <input
            type="search"
            placeholder="Cari nama / deskripsi produk…"
            value={query}
            onChange={(e) => setFilter({ q: e.target.value, page: 1 })}
            className={inputClass}
          />
        </div>
        <div className="w-full sm:w-44">
          <select
            value={categoryFilter}
            onChange={(e) => setFilter({ cat: e.target.value, page: 1 })}
            className={inputClass}
            aria-label="Filter kategori"
          >
            <option value="all">Semua Kategori</option>
            {categoryNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-36">
          <select
            value={statusFilter}
            onChange={(e) => setFilter({ status: e.target.value, page: 1 })}
            className={inputClass}
            aria-label="Filter status"
          >
            {statusFilterOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} dari {rows.length} produk
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            title="Tidak ada produk yang cocok"
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
                <th className="px-4 py-3 font-medium">Produk</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Harga</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageRows.map((p) => {
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
                      {p.vendor_price != null && (
                        <span className="block text-xs font-normal text-gray-400">
                          vendor Rp{" "}
                          {Number(p.vendor_price).toLocaleString("id-ID")} ·
                          margin Rp{" "}
                          {(
                            p.price - Number(p.vendor_price)
                          ).toLocaleString("id-ID")}
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
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Ubah
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(p)}
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
        title={confirmRow ? `Hapus produk "${confirmRow.name}"?` : ""}
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
            {impact.bookings.length > 0 && (
              <>
                <p className="pt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                  Booking terkait — klik untuk memeriksa
                </p>
                <ImpactBookingList bookings={impact.bookings} />
              </>
            )}
          </>
        )}
      </ConfirmModal>
    </div>
  );
}
