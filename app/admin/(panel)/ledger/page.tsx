"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Transaction, TransactionCategory } from "@/lib/types";
import {
  Badge,
  Breadcrumbs,
  Card,
  EmptyState,
  Skeleton,
  btnPrimary,
  formatDate,
  formatRupiah,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { PencilIcon, PlusIcon, WalletIcon } from "@/components/admin/icons";
import Pagination from "@/components/admin/Pagination";
import ConfirmModal from "@/components/admin/ConfirmModal";

type ListRow = Transaction & { category: { name: string } | null };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function LedgerPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ListRow[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters default to the current month — the ledger is mostly
  // browsed "this month so far".
  const [month, setMonth] = useState(currentMonth());
  const [directionFilter, setDirectionFilter] = useState<"" | "in" | "out">("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Create form.
  const [formDirection, setFormDirection] = useState<"in" | "out">("out");
  const [submitting, setSubmitting] = useState(false);

  // Reverse flow.
  const [confirmRow, setConfirmRow] = useState<ListRow | null>(null);
  const [reversing, setReversing] = useState(false);

  // Category settings.
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryDirection, setNewCategoryDirection] = useState<"in" | "out">("out");
  const [categoryBusy, setCategoryBusy] = useState(false);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  async function loadAll() {
    try {
      const [txRes, catRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*, category:transaction_categories(name)")
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("transaction_categories")
          .select("*")
          .order("sort_order")
          .order("name"),
      ]);
      if (txRes.error) throw new Error(txRes.error.message);
      if (catRes.error) throw new Error(catRes.error.message);
      setRows((txRes.data ?? []) as ListRow[]);
      setCategories((catRes.data ?? []) as TransactionCategory[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat buku kas");
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Ids of rows that have been reversed by a later row (for the badge).
  const reversedIds = useMemo(
    () =>
      new Set(
        rows
          .map((r) => r.reverses_transaction_id)
          .filter((id): id is string => id != null),
      ),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.transaction_date.startsWith(month) &&
          (directionFilter === "" || r.direction === directionFilter) &&
          (categoryFilter === "" || r.category_id === categoryFilter),
      ),
    [rows, month, directionFilter, categoryFilter],
  );

  const totals = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    for (const r of filtered) {
      if (r.direction === "in") masuk += Number(r.amount);
      else keluar += Number(r.amount);
    }
    return { masuk, keluar, net: masuk - keluar };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Create form categories: active ones matching the chosen direction.
  const formCategories = categories.filter(
    (c) => c.is_active && c.direction === formDirection,
  );

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const payload: Record<string, unknown> = {
      direction: formDirection,
      amount: (f.namedItem("amount") as HTMLInputElement).value,
      transaction_date: (f.namedItem("transaction_date") as HTMLInputElement).value,
      category_id: (f.namedItem("category_id") as HTMLSelectElement).value,
      account: (f.namedItem("account") as HTMLInputElement).value,
      description: (f.namedItem("description") as HTMLInputElement).value,
    };
    const periodStart = (f.namedItem("period_start") as HTMLInputElement).value;
    const periodEnd = (f.namedItem("period_end") as HTMLInputElement).value;
    if (periodStart) payload.period_start = periodStart;
    if (periodEnd) payload.period_end = periodEnd;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Routes return JSON errors; a crashed server returns an HTML
        // page that .json() cannot parse — fall back to the status.
        let message = `Gagal mencatat transaksi (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      (e.target as HTMLFormElement).reset();
      loadAll();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mencatat transaksi");
    } finally {
      setSubmitting(false);
    }
  }

  async function performReverse() {
    if (!confirmRow) return;

    setReversing(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: confirmRow.id, action: "reverse" }),
      });

      if (!res.ok) {
        let message = `Gagal membalikkan transaksi (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      loadAll();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membalikkan transaksi");
    } finally {
      setConfirmRow(null);
      setReversing(false);
    }
  }

  async function handleAddCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCategory.trim()) return;

    setCategoryBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/transaction-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategory,
          direction: newCategoryDirection,
          sort_order: categories.length * 10 + 10,
        }),
      });

      if (!res.ok) {
        let message = `Gagal menambah kategori (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      setNewCategory("");
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah kategori");
    } finally {
      setCategoryBusy(false);
    }
  }

  async function toggleCategory(c: TransactionCategory) {
    setCategoryBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/transaction-categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
      });

      if (!res.ok) {
        let message = `Gagal mengubah kategori (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah kategori");
    } finally {
      setCategoryBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="mb-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Kas" },
            ]}
          />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Buku Kas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Semua uang masuk dan keluar. Salah catat? Balikkan — jangan
          dihapus.
        </p>
      </div>

      {/* Filters + totals */}
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="filter-month" className={labelClass}>
              Bulan
            </label>
            <input
              id="filter-month"
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="filter-direction" className={labelClass}>
              Arah
            </label>
            <select
              id="filter-direction"
              value={directionFilter}
              onChange={(e) => {
                setDirectionFilter(e.target.value as "" | "in" | "out");
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">Semua</option>
              <option value="in">Masuk</option>
              <option value="out">Keluar</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-category" className={labelClass}>
              Kategori
            </label>
            <select
              id="filter-category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">Semua</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-gray-100 pt-4 text-center">
          <div>
            <p className="text-xs text-gray-400">Masuk</p>
            <p className="text-sm font-semibold text-green-700">
              {formatRupiah(totals.masuk)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Keluar</p>
            <p className="text-sm font-semibold text-red-700">
              {formatRupiah(totals.keluar)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Selisih</p>
            <p
              className={`text-sm font-semibold ${
                totals.net < 0 ? "text-red-700" : "text-gray-900"
              }`}
            >
              {formatRupiah(totals.net)}
            </p>
          </div>
        </div>
      </Card>

      {/* Create */}
      <Card className="mb-4 p-4">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Arah</label>
              <div className="grid grid-cols-2 gap-2">
                {(["in", "out"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFormDirection(d)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      formDirection === d
                        ? d === "in"
                          ? "border-green-600 bg-green-50 text-green-700"
                          : "border-red-600 bg-red-50 text-red-700"
                        : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {d === "in" ? "Masuk" : "Keluar"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="tx-amount" className={labelClass}>
                Nominal
              </label>
              <input
                id="tx-amount"
                name="amount"
                type="number"
                min="1"
                step="any"
                required
                placeholder="50000"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="tx-date" className={labelClass}>
                Tanggal
              </label>
              <input
                id="tx-date"
                name="transaction_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="tx-category" className={labelClass}>
                Kategori
              </label>
              <select
                id="tx-category"
                name="category_id"
                required
                key={formDirection}
                className={inputClass}
              >
                {formCategories.length === 0 && (
                  <option value="">
                    {formDirection === "in"
                      ? "Belum ada kategori masuk"
                      : "Belum ada kategori keluar"}
                  </option>
                )}
                {formCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="tx-account" className={labelClass}>
                Akun (opsional)
              </label>
              <input
                id="tx-account"
                name="account"
                type="text"
                placeholder="mis. Cash, BCA"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="tx-description" className={labelClass}>
                Keterangan (opsional)
              </label>
              <input
                id="tx-description"
                name="description"
                type="text"
                placeholder="mis. Isi angin balon"
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="tx-period-start" className={labelClass}>
                Periode gaji mulai (opsional)
              </label>
              <input
                id="tx-period-start"
                name="period_start"
                type="date"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="tx-period-end" className={labelClass}>
                Periode gaji akhir (opsional)
              </label>
              <input
                id="tx-period-end"
                name="period_end"
                type="date"
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className={btnPrimary}>
            <PlusIcon className="h-4 w-4" />
            Catat
          </button>
        </form>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </Card>

      {/* Transactions */}
      <Card className="mb-4">
        {initialLoading ? (
          <div className="space-y-4 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <>
            <ul className="divide-y divide-gray-100">
              {pageItems.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                      r.direction === "in"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.direction === "in" ? "+" : "−"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {r.description || r.category?.name || "Transaksi"}
                      </p>
                      {reversedIds.has(r.id) && (
                        <Badge tone="red">Dibalikkan</Badge>
                      )}
                      {r.reverses_transaction_id && (
                        <Badge tone="gray">Pembalikan</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-400">
                      {[
                        formatDate(r.transaction_date),
                        r.category?.name,
                        r.account,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        r.direction === "in" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {r.direction === "in" ? "+" : "−"}
                      {formatRupiah(Number(r.amount))}
                    </span>
                    {!r.reverses_transaction_id && !reversedIds.has(r.id) && (
                      <button
                        type="button"
                        onClick={() => setConfirmRow(r)}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                      >
                        Balikkan
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-100 px-4 py-3">
              <Pagination
                page={safePage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={PAGE_SIZE}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="Belum ada transaksi"
            subtitle="Catat uang masuk/keluar pertama pada bulan ini."
          />
        )}
      </Card>

      {/* Category settings */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <WalletIcon className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">
            Kategori Transaksi
          </h2>
        </div>
        <form
          onSubmit={handleAddCategory}
          className="mb-3 grid gap-2 sm:grid-cols-[1fr_130px_auto]"
        >
          <input
            type="text"
            required
            placeholder="Kategori baru — mis. Sewa Gudang"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className={inputClass}
          />
          <select
            value={newCategoryDirection}
            onChange={(e) =>
              setNewCategoryDirection(e.target.value as "in" | "out")
            }
            className={inputClass}
            aria-label="Arah kategori"
          >
            <option value="out">Keluar</option>
            <option value="in">Masuk</option>
          </select>
          <button
            type="submit"
            disabled={categoryBusy}
            className={btnPrimary + " sm:w-auto"}
          >
            <PlusIcon className="h-4 w-4" />
            Tambah
          </button>
        </form>
        <ul className="divide-y divide-gray-100">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-gray-900">{c.name}</span>
                <Badge tone={c.direction === "in" ? "green" : "red"}>
                  {c.direction === "in" ? "Masuk" : "Keluar"}
                </Badge>
                {!c.is_active && <Badge tone="gray">Nonaktif</Badge>}
              </div>
              <button
                type="button"
                disabled={categoryBusy}
                onClick={() => toggleCategory(c)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                {c.is_active ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <ConfirmModal
        open={confirmRow !== null}
        title="Balikkan transaksi ini?"
        description="Baris pembalikan akan dicatat otomatis."
        busy={reversing}
        onConfirm={performReverse}
        onClose={() => setConfirmRow(null)}
      >
        <p className="text-gray-600">
          Buku kas bersifat append-only: transaksi tidak pernah dihapus
          atau diedit. Salah catat dibalikkan dengan baris pembalikan,
          lalu catat yang benar.
        </p>
      </ConfirmModal>
    </div>
  );
}
