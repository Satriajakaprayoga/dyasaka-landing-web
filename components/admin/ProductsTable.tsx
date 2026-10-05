"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category, Product, ProductImage } from "@/lib/types";
import { Badge, Card, EmptyState, inputClass } from "./ui";
import { PackageIcon, PencilIcon, TrashIcon } from "./icons";

type Row = Product & {
  categories: Pick<Category, "name">;
  product_images: Pick<ProductImage, "image_url" | "sort_order">[];
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
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

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

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <input
            type="search"
            placeholder="Cari nama / deskripsi produk…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="w-full sm:w-44">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
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
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "inactive")
            }
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
              onClick={() => {
                setQuery("");
                setCategoryFilter("all");
                setStatusFilter("all");
              }}
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
      )}
    </div>
  );
}
