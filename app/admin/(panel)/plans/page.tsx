"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { PlanType, PurchasePlan } from "@/lib/types";
import {
  Breadcrumbs,
  Card,
  EmptyState,
  PlanStatusBadge,
  PlanTypeBadge,
  Skeleton,
  btnPrimary,
  formatDate,
  formatRupiah,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { ChevronRightIcon, ClipboardIcon, PlusIcon, TrashIcon } from "@/components/admin/icons";
import ConfirmModal from "@/components/admin/ConfirmModal";

type ListRow = PurchasePlan & { booking: { customer_name: string } | null };

const planTypes: { value: PlanType; label: string }[] = [
  { value: "buy", label: "Beli Barang" },
  { value: "create", label: "Buat Baru" },
  { value: "fix", label: "Perbaikan" },
  { value: "rnd", label: "Riset" },
  { value: "upgrade", label: "Upgrade" },
];

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<ListRow[]>([]);
  const [bookings, setBookings] = useState<
    { id: string; customer_name: string; event_date: string }[]
  >([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmRow, setConfirmRow] = useState<ListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadPlans() {
    try {
      const { data, error } = await supabase
        .from("purchase_plans")
        .select("*, booking:bookings(customer_name)")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      setPlans((data ?? []) as ListRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat rencana");
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([
        loadPlans(),
        (async () => {
          const { data } = await supabase
            .from("bookings")
            .select("id, customer_name, event_date")
            .order("event_date", { ascending: false })
            .limit(50);
          setBookings(data ?? []);
        })(),
      ]);
    })();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    const payload = {
      title: (f.namedItem("title") as HTMLInputElement).value,
      plan_type: (f.namedItem("plan_type") as HTMLSelectElement).value,
      budget_estimate: (f.namedItem("budget_estimate") as HTMLInputElement)
        .value || null,
      target_date: (f.namedItem("target_date") as HTMLInputElement).value || null,
      reason: (f.namedItem("reason") as HTMLInputElement).value,
      booking_id: (f.namedItem("booking_id") as HTMLSelectElement).value || null,
    };

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = `Gagal membuat rencana (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      const body = await res.json();
      router.push(`/admin/plans/${body.plan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat rencana");
    } finally {
      setSubmitting(false);
    }
  }

  function closeConfirm() {
    setConfirmRow(null);
  }

  async function performDelete() {
    if (!confirmRow) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/plans?id=${confirmRow.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        let message = `Gagal menghapus rencana (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus rencana");
    } finally {
      closeConfirm();
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="mb-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Rencana" },
            ]}
          />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Rencana Pembelian</h1>
        <p className="mt-1 text-sm text-gray-500">
          Beli barang, perbaikan, riset, dan upgrade — sebelum jadi pesanan
        </p>
      </div>

      <Card className="mb-4 p-4">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
            <div>
              <label htmlFor="plan-title" className={labelClass}>
                Judul
              </label>
              <input
                id="plan-title"
                name="title"
                type="text"
                required
                placeholder="mis. Beli kompor tambahan"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="plan-type" className={labelClass}>
                Jenis
              </label>
              <select
                id="plan-type"
                name="plan_type"
                className={inputClass}
                defaultValue="buy"
              >
                {planTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="plan-budget" className={labelClass}>
                Estimasi anggaran
              </label>
              <input
                id="plan-budget"
                name="budget_estimate"
                type="number"
                min="0"
                step="1000"
                placeholder="Rp"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="plan-target" className={labelClass}>
                Target selesai
              </label>
              <input
                id="plan-target"
                name="target_date"
                type="date"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="plan-booking" className={labelClass}>
                Booking (opsional)
              </label>
              <select id="plan-booking" name="booking_id" className={inputClass}>
                <option value="">—</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.customer_name} · {formatDate(b.event_date)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="plan-reason" className={labelClass}>
              Alasan
            </label>
            <input
              id="plan-reason"
              name="reason"
              type="text"
              placeholder="Kenapa rencana ini dibuat (opsional)"
              className={inputClass}
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={submitting} className={btnPrimary}>
              <PlusIcon className="h-4 w-4" />
              Buat Rencana
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </Card>

      <Card>
        {initialLoading ? (
          <div className="space-y-4 p-4" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : plans.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {plans.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/plans/${p.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                      <ClipboardIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {p.title}
                        </p>
                        <PlanTypeBadge type={p.plan_type} />
                        <PlanStatusBadge status={p.status} />
                      </div>
                      <p className="truncate text-xs text-gray-400">
                        {[
                          p.booking?.customer_name
                            ? `Untuk ${p.booking.customer_name}`
                            : null,
                          p.budget_estimate != null
                            ? `Anggaran ${formatRupiah(Number(p.budget_estimate))}`
                            : null,
                          p.target_date ? `Target ${formatDate(p.target_date)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmRow(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRightIcon className="h-4 w-4 text-gray-300" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Belum ada rencana"
            subtitle="Buat rencana pembelian, perbaikan, atau riset pertama."
          />
        )}
      </Card>

      <ConfirmModal
        open={confirmRow !== null}
        title={confirmRow ? `Hapus rencana "${confirmRow.title}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={deleting}
        onConfirm={performDelete}
        onClose={closeConfirm}
      >
        <p className="text-gray-600">
          Semua baris di dalamnya ikut terhapus. Tindakan ini tidak dapat
          dibatalkan.
        </p>
      </ConfirmModal>
    </div>
  );
}
