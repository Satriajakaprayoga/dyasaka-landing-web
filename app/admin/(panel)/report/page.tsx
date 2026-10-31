"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/lib/types";
import {
  Breadcrumbs,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  formatRupiah,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { ChartIcon } from "@/components/admin/icons";

type ListRow = Transaction & { category: { name: string } | null };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export default function ReportPage() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(currentMonth());
  const [accountFilter, setAccountFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("transactions")
          .select("*, category:transaction_categories(name)")
          .order("transaction_date", { ascending: false });
        if (error) throw new Error(error.message);
        setRows((data ?? []) as ListRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat laporan");
      } finally {
        setInitialLoading(false);
      }
    })();
  }, []);

  // Accounts the admin has actually used (for the optional filter).
  const accounts = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.account) set.add(r.account);
    }
    return [...set].sort();
  }, [rows]);

  const monthRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.transaction_date.startsWith(month) &&
          (accountFilter === "" || (r.account ?? "") === accountFilter),
      ),
    [rows, month, accountFilter],
  );

  const totals = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    for (const r of monthRows) {
      if (r.direction === "in") masuk += Number(r.amount);
      else keluar += Number(r.amount);
    }
    return { masuk, keluar, net: masuk - keluar };
  }, [monthRows]);

  // One row per category with activity in the month: money in and out.
  const perCategory = useMemo(() => {
    const map = new Map<string, { name: string; masuk: number; keluar: number }>();
    for (const r of monthRows) {
      const key = r.category_id ?? "-";
      const entry = map.get(key) ?? {
        name: r.category?.name ?? "Tanpa kategori",
        masuk: 0,
        keluar: 0,
      };
      if (r.direction === "in") entry.masuk += Number(r.amount);
      else entry.keluar += Number(r.amount);
      map.set(key, entry);
    }
    return [...map.values()].sort(
      (a, b) => b.masuk + b.keluar - (a.masuk + a.keluar),
    );
  }, [monthRows]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="mb-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Laporan" },
            ]}
          />
        </div>
        <PageHeader
          title="Laporan Bulanan"
          subtitle="Arus kas per bulan dari buku kas — uang masuk, keluar, dan saldo"
        />
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <div>
            <label htmlFor="report-month" className={labelClass}>
              Bulan
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                aria-label="Bulan sebelumnya"
                className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
              >
                ‹
              </button>
              <input
                id="report-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value || currentMonth())}
                className={inputClass + " w-40"}
              />
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                aria-label="Bulan berikutnya"
                className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
              >
                ›
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="report-account" className={labelClass}>
              Akun (opsional)
            </label>
            <select
              id="report-account"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className={inputClass}
            >
              <option value="">Semua akun</option>
              {accounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {initialLoading ? (
        <Card className="space-y-4 p-4" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : error ? (
        <Card className="p-4">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        </Card>
      ) : monthRows.length === 0 ? (
        <Card>
          <EmptyState
            title={`Belum ada transaksi di ${monthLabel(month)}`}
            subtitle="Catat transaksi di halaman Kas untuk melihat laporannya."
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Masuk
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-green-600">
                <ChartIcon className="h-4 w-4" />
                {formatRupiah(totals.masuk)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Keluar
              </p>
              <p className="mt-1 text-lg font-semibold text-red-600">
                {formatRupiah(totals.keluar)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Saldo
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  totals.net >= 0 ? "text-gray-900" : "text-red-600"
                }`}
              >
                {formatRupiah(totals.net)}
              </p>
            </Card>
          </div>

          <Card>
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">
                Per kategori — {monthLabel(month)}
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2 font-medium">Kategori</th>
                  <th className="px-4 py-2 text-right font-medium">Masuk</th>
                  <th className="px-4 py-2 text-right font-medium">Keluar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {perCategory.map((c) => (
                  <tr key={c.name}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      {c.name}
                    </td>
                    <td className="px-4 py-2.5 text-right text-green-600">
                      {c.masuk > 0 ? formatRupiah(c.masuk) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {c.keluar > 0 ? formatRupiah(c.keluar) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-semibold text-gray-900">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right text-green-600">
                    {formatRupiah(totals.masuk)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-red-600">
                    {formatRupiah(totals.keluar)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
