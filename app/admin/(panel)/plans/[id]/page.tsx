"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type {
  PlanLineOutcome,
  PlanStatus,
  PlanType,
  PurchasePlan,
  PurchasePlanLine,
  Supplier,
} from "@/lib/types";
import {
  BackLink,
  Badge,
  Breadcrumbs,
  Card,
  EmptyState,
  PlanStatusBadge,
  PlanTypeBadge,
  Skeleton,
  btnPrimary,
  btnSecondary,
  formatDate,
  formatRupiah,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { PlusIcon, TrashIcon } from "@/components/admin/icons";
import ConfirmModal from "@/components/admin/ConfirmModal";

type LineRow = PurchasePlanLine & {
  supplier: { name: string } | null;
  po_item: {
    id: string;
    quantity_ordered: number;
    quantity_received: number | null;
    unit_cost: number;
  } | null;
};

type VariantOption = {
  id: string;
  color: string | null;
  size: string | null;
  items: { name: string } | null;
};

type TxRow = {
  id: string;
  direction: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  plan_line_id: string | null;
};

type PlanMeta = PurchasePlan & {
  booking: { customer_name: string; event_date: string } | null;
};

const planTypes: { value: PlanType; label: string }[] = [
  { value: "buy", label: "Beli Barang" },
  { value: "create", label: "Buat Baru" },
  { value: "fix", label: "Perbaikan" },
  { value: "rnd", label: "Riset" },
  { value: "upgrade", label: "Upgrade" },
];

const outcomeLabels: Record<PlanLineOutcome, string> = {
  testing: "Sedang diuji",
  adopted: "Diadopsi",
  rejected: "Ditolak",
};

function variantLabel(v: VariantOption) {
  const bits = [v.items?.name, v.color, v.size].filter(Boolean);
  return bits.join(" — ");
}

// Line status is derived, never typed by hand (doc §15).
function lineStatus(l: LineRow): "open" | "ordered" | "done" {
  if (l.done_at) return "done";
  if (
    l.po_item &&
    (l.po_item.quantity_received ?? 0) >= l.po_item.quantity_ordered
  ) {
    return "done";
  }
  if (l.purchase_order_item_id) return "ordered";
  return "open";
}

const lineStatusBadge = {
  open: <Badge tone="gray">Belum</Badge>,
  ordered: <Badge tone="amber">Dipesan</Badge>,
  done: <Badge tone="green">Selesai</Badge>,
};

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [plan, setPlan] = useState<PlanMeta | null>(null);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [ledger, setLedger] = useState<TxRow[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [confirmLine, setConfirmLine] = useState<LineRow | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function loadPlan() {
    const { data, error } = await supabase
      .from("purchase_plans")
      .select("*, booking:bookings(customer_name, event_date)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    setPlan((data as PlanMeta) ?? null);
    if (!data) setNotFound(true);
  }

  async function loadLines() {
    const { data, error } = await supabase
      .from("purchase_plan_lines")
      .select(
        "*, supplier:suppliers(name), po_item:purchase_order_items(id, quantity_ordered, quantity_received, unit_cost)",
      )
      .eq("plan_id", id)
      .order("sort_order");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as LineRow[];
    setLines(rows);

    // Actual cost comes from ledger rows linked to the plan's lines.
    const ids = rows.map((l) => l.id);
    if (ids.length === 0) {
      setLedger([]);
      return;
    }
    const { data: tx, error: txError } = await supabase
      .from("transactions")
      .select(
        "id, direction, amount, description, transaction_date, plan_line_id",
      )
      .in("plan_line_id", ids);
    if (txError) throw new Error(txError.message);
    setLedger((tx ?? []) as TxRow[]);
  }

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        await Promise.all([
          loadPlan(),
          loadLines(),
          (async () => {
            const s = await supabase.from("suppliers").select("*").order("name");
            if (s.error) throw new Error(s.error.message);
            setSuppliers((s.data ?? []) as Supplier[]);
          })(),
          (async () => {
            const v = await supabase
              .from("item_variants")
              .select("id, color, size, items(name)")
              .order("id");
            if (v.error) throw new Error(v.error.message);
            // Runtime returns a to-one embed as an object; the generated
            // types model it as an array, hence the unknown cast.
            setVariants((v.data ?? []) as unknown as VariantOption[]);
          })(),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat rencana");
      } finally {
        setInitialLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const estimatedTotal = useMemo(
    () =>
      lines.reduce(
        (sum, l) =>
          sum + l.quantity * (l.estimated_unit_cost != null ? Number(l.estimated_unit_cost) : 0),
        0,
      ),
    [lines],
  );

  // Goods bought via purchase orders never touch the ledger with a
  // plan_line_id (PO payments carry purchase_order_id), so their cost
  // enters the realisasi as received quantity × unit cost. Several plan
  // lines can share one PO item — count each PO item once.
  const poCostTotal = useMemo(() => {
    const seen = new Set<string>();
    let sum = 0;
    for (const l of lines) {
      const p = l.po_item;
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      sum += (p.quantity_received ?? 0) * Number(p.unit_cost);
    }
    return sum;
  }, [lines]);

  const ledgerTotal = useMemo(
    () =>
      ledger
        .filter((t) => t.direction === "out")
        .reduce((sum, t) => sum + Number(t.amount), 0),
    [ledger],
  );

  const actualTotal = ledgerTotal + poCostTotal;

  const ledgerByLine = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of ledger) {
      if (t.direction !== "out" || !t.plan_line_id) continue;
      map.set(t.plan_line_id, (map.get(t.plan_line_id) ?? 0) + Number(t.amount));
    }
    return map;
  }, [ledger]);

  async function api(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let message = `Gagal (HTTP ${res.status})`;
      try {
        const b = await res.json();
        if (b.error) message = b.error;
      } catch {
        // HTML error page — keep the generic message.
      }
      throw new Error(message);
    }
    return res.json();
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  function refreshAll() {
    return Promise.all([loadPlan(), loadLines()]);
  }

  async function handleEditPlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget.elements;
    await run(async () => {
      await api("/api/admin/plans", "PATCH", {
        id,
        title: (f.namedItem("title") as HTMLInputElement).value,
        plan_type: (f.namedItem("plan_type") as HTMLSelectElement).value,
        budget_estimate: (f.namedItem("budget_estimate") as HTMLInputElement)
          .value || null,
        target_date: (f.namedItem("target_date") as HTMLInputElement).value || null,
        reason: (f.namedItem("reason") as HTMLInputElement).value,
      });
      setEditingPlan(false);
      await loadPlan();
      router.refresh();
    });
  }

  async function handleAddLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = form.elements;
    const payload = {
      plan_id: id,
      description: (f.namedItem("description") as HTMLInputElement).value,
      quantity: (f.namedItem("quantity") as HTMLInputElement).value,
      estimated_unit_cost:
        (f.namedItem("estimated_unit_cost") as HTMLInputElement).value || null,
      supplier_id: (f.namedItem("supplier_id") as HTMLSelectElement).value || null,
      item_variant_id:
        (f.namedItem("item_variant_id") as HTMLSelectElement).value || null,
      replaces_item_variant_id:
        plan?.plan_type === "upgrade"
          ? (f.namedItem("replaces_item_variant_id") as HTMLSelectElement).value ||
            null
          : undefined,
    };
    await run(async () => {
      await api("/api/admin/plan-lines", "POST", payload);
      form.reset();
      await refreshAll();
      router.refresh();
    });
  }

  async function handleUpdateLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingLineId) return;
    const f = e.currentTarget.elements;
    await run(async () => {
      await api("/api/admin/plan-lines", "PATCH", {
        id: editingLineId,
        description: (f.namedItem("description") as HTMLInputElement).value,
        quantity: (f.namedItem("quantity") as HTMLInputElement).value,
        estimated_unit_cost:
          (f.namedItem("estimated_unit_cost") as HTMLInputElement).value || null,
        supplier_id: (f.namedItem("supplier_id") as HTMLSelectElement).value || null,
        item_variant_id:
          (f.namedItem("item_variant_id") as HTMLSelectElement).value || null,
        replaces_item_variant_id:
          plan?.plan_type === "upgrade"
            ? (f.namedItem("replaces_item_variant_id") as HTMLSelectElement)
                .value || null
            : undefined,
        outcome_note:
          plan?.plan_type === "rnd"
            ? (f.namedItem("outcome_note") as HTMLInputElement).value
            : undefined,
      });
      setEditingLineId(null);
      await loadLines();
      router.refresh();
    });
  }

  async function patchLine(lineId: string, patch: Record<string, unknown>) {
    await run(async () => {
      await api("/api/admin/plan-lines", "PATCH", { id: lineId, ...patch });
      await refreshAll();
      router.refresh();
    });
  }

  async function performDeleteLine() {
    if (!confirmLine) return;
    await run(async () => {
      await api(`/api/admin/plan-lines?id=${confirmLine.id}`, "DELETE");
      setConfirmLine(null);
      await refreshAll();
      router.refresh();
    });
  }

  async function setPlanStatus(status: PlanStatus) {
    await run(async () => {
      await api("/api/admin/plans", "PATCH", { id, status });
      await loadPlan();
      router.refresh();
    });
  }

  if (initialLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !plan) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <EmptyState
            title="Rencana tidak ditemukan"
            subtitle="Mungkin sudah dihapus."
          >
            <Link href="/admin/plans" className={btnSecondary}>
              Kembali ke daftar rencana
            </Link>
          </EmptyState>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Rencana", href: "/admin/plans" },
              { label: plan.title },
            ]}
          />
          <BackLink href="/admin/plans" />
        </div>
        {editingPlan ? (
          <Card className="p-4">
            <form onSubmit={handleEditPlan} className="space-y-3">
              <div>
                <label htmlFor="edit-title" className={labelClass}>
                  Judul
                </label>
                <input
                  id="edit-title"
                  name="title"
                  type="text"
                  required
                  defaultValue={plan.title}
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="edit-type" className={labelClass}>
                    Jenis
                  </label>
                  <select
                    id="edit-type"
                    name="plan_type"
                    defaultValue={plan.plan_type}
                    className={inputClass}
                  >
                    {planTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-budget" className={labelClass}>
                    Anggaran
                  </label>
                  <input
                    id="edit-budget"
                    name="budget_estimate"
                    type="number"
                    min="0"
                    step="1000"
                    defaultValue={plan.budget_estimate ?? ""}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="edit-target" className={labelClass}>
                    Target
                  </label>
                  <input
                    id="edit-target"
                    name="target_date"
                    type="date"
                    defaultValue={plan.target_date ?? ""}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="edit-reason" className={labelClass}>
                  Alasan
                </label>
                <input
                  id="edit-reason"
                  name="reason"
                  type="text"
                  defaultValue={plan.reason ?? ""}
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                >
                  Batal
                </button>
                <button type="submit" disabled={busy} className={btnPrimary}>
                  Simpan
                </button>
              </div>
            </form>
          </Card>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {plan.title}
                </h1>
                <PlanTypeBadge type={plan.plan_type} />
                <PlanStatusBadge status={plan.status} />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {[
                  plan.booking
                    ? `Booking ${plan.booking.customer_name} · ${formatDate(plan.booking.event_date)}`
                    : null,
                  plan.reason,
                ]
                  .filter(Boolean)
                  .join(" — ") || "Tidak ada keterangan tambahan"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {plan.status === "draft" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPlanStatus("approved")}
                  className={btnPrimary}
                >
                  Setujui
                </button>
              )}
              {["draft", "approved", "in_progress"].includes(plan.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmCancel(true)}
                  className={btnSecondary}
                >
                  Batalkan
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingPlan(true)}
                className={btnSecondary}
              >
                Ubah
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Card className="mb-4 p-4">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        </Card>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Estimasi
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatRupiah(estimatedTotal)}
          </p>
          {plan.budget_estimate != null && (
            <p className="mt-0.5 text-xs text-gray-400">
              Anggaran {formatRupiah(Number(plan.budget_estimate))}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Realisasi
          </p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatRupiah(actualTotal)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {[
              `${ledger.filter((t) => t.direction === "out").length} pengeluaran kas`,
              poCostTotal > 0
                ? `barang diterima ${formatRupiah(poCostTotal)}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Selisih
          </p>
          <p
            className={`mt-1 text-lg font-semibold ${
              estimatedTotal - actualTotal >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatRupiah(estimatedTotal - actualTotal)}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">Estimasi − realisasi</p>
        </Card>
      </div>

      <Card className="mb-4 p-4">
        <form onSubmit={handleAddLine} className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Tambah Baris</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_90px_140px]">
            <div>
              <label htmlFor="line-desc" className={labelClass}>
                Deskripsi
              </label>
              <input
                id="line-desc"
                name="description"
                type="text"
                required
                placeholder="mis. Kain satin 3 meter"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="line-qty" className={labelClass}>
                Jumlah
              </label>
              <input
                id="line-qty"
                name="quantity"
                type="number"
                min="1"
                step="1"
                defaultValue={1}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="line-cost" className={labelClass}>
                Est. biaya / unit
              </label>
              <input
                id="line-cost"
                name="estimated_unit_cost"
                type="number"
                min="0"
                step="1000"
                placeholder="Rp"
                className={inputClass}
              />
            </div>
          </div>
          <div
            className={`grid gap-3 ${
              plan.plan_type === "upgrade" ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            <div>
              <label htmlFor="line-supplier" className={labelClass}>
                Supplier
              </label>
              <select
                id="line-supplier"
                name="supplier_id"
                className={inputClass}
              >
                <option value="">—</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="line-variant" className={labelClass}>
                Item katalog (opsional)
              </label>
              <select
                id="line-variant"
                name="item_variant_id"
                className={inputClass}
              >
                <option value="">—</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {variantLabel(v)}
                  </option>
                ))}
              </select>
            </div>
            {plan.plan_type === "upgrade" && (
              <div>
                <label htmlFor="line-replaces" className={labelClass}>
                  Menggantikan
                </label>
                <select
                  id="line-replaces"
                  name="replaces_item_variant_id"
                  className={inputClass}
                >
                  <option value="">—</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {variantLabel(v)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className={btnPrimary}>
              <PlusIcon className="h-4 w-4" />
              Tambah
            </button>
          </div>
        </form>
      </Card>

      <Card>
        {lines.length === 0 ? (
          <EmptyState
            title="Belum ada baris"
            subtitle="Tambahkan barang atau pekerjaan yang direncanakan."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {lines.map((l) => {
              const actual = ledgerByLine.get(l.id);
              return (
                <li key={l.id} className="px-4 py-3">
                  {editingLineId === l.id ? (
                    <form onSubmit={handleUpdateLine} className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[1fr_90px_140px]">
                        <input
                          name="description"
                          type="text"
                          required
                          defaultValue={l.description}
                          className={inputClass}
                          autoFocus
                        />
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          step="1"
                          defaultValue={l.quantity}
                          required
                          className={inputClass}
                        />
                        <input
                          name="estimated_unit_cost"
                          type="number"
                          min="0"
                          step="1000"
                          defaultValue={l.estimated_unit_cost ?? ""}
                          className={inputClass}
                        />
                      </div>
                      <div
                        className={`grid gap-3 ${
                          plan.plan_type === "rnd"
                            ? "sm:grid-cols-2 lg:grid-cols-4"
                            : plan.plan_type === "upgrade"
                              ? "sm:grid-cols-3"
                              : "sm:grid-cols-2"
                        }`}
                      >
                        <select
                          name="supplier_id"
                          defaultValue={l.supplier_id ?? ""}
                          className={inputClass}
                        >
                          <option value="">Tanpa supplier</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <select
                          name="item_variant_id"
                          defaultValue={l.item_variant_id ?? ""}
                          className={inputClass}
                        >
                          <option value="">Tanpa item katalog</option>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {variantLabel(v)}
                            </option>
                          ))}
                        </select>
                        {plan.plan_type === "upgrade" && (
                          <select
                            name="replaces_item_variant_id"
                            defaultValue={l.replaces_item_variant_id ?? ""}
                            className={inputClass}
                          >
                            <option value="">Menggantikan: —</option>
                            {variants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {variantLabel(v)}
                              </option>
                            ))}
                          </select>
                        )}
                        {plan.plan_type === "rnd" && (
                          <input
                            name="outcome_note"
                            type="text"
                            placeholder="Catatan hasil"
                            defaultValue={l.outcome_note ?? ""}
                            className={inputClass}
                          />
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingLineId(null)}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={busy}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                        >
                          {busy ? "…" : "Simpan"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {l.description}
                            </p>
                            {lineStatusBadge[lineStatus(l)]}
                            {plan.plan_type === "rnd" && l.outcome && (
                              <Badge tone="blue">
                                {outcomeLabels[l.outcome]}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-gray-400">
                            {[
                              `${l.quantity} × ${
                                l.estimated_unit_cost != null
                                  ? formatRupiah(Number(l.estimated_unit_cost))
                                  : "biaya belum diisi"
                              } = ${
                                l.estimated_unit_cost != null
                                  ? formatRupiah(
                                      l.quantity * Number(l.estimated_unit_cost),
                                    )
                                  : "?"
                              }`,
                              l.supplier?.name,
                              actual != null ? `Realisasi ${formatRupiah(actual)}` : null,
                              l.po_item
                                ? `PO ${formatRupiah(
                                    (l.po_item.quantity_received ?? 0) *
                                      Number(l.po_item.unit_cost),
                                  )}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {l.done_at ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => patchLine(l.id, { done_at: null })}
                              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100"
                            >
                              Batal Selesai
                            </button>
                          ) : (
                            lineStatus(l) !== "done" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  patchLine(l.id, {
                                    done_at: new Date().toISOString(),
                                  })
                                }
                                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-green-600 transition hover:bg-green-50"
                              >
                                Selesai
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingLineId(l.id)}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmLine(l)}
                            disabled={busy}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {plan.plan_type === "rnd" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-400">Hasil:</span>
                          {(
                            ["testing", "adopted", "rejected"] as PlanLineOutcome[]
                          ).map((o) => (
                            <button
                              key={o}
                              type="button"
                              disabled={busy}
                              onClick={() => patchLine(l.id, { outcome: o })}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition ${
                                l.outcome === o
                                  ? "bg-gray-900 text-white ring-gray-900"
                                  : "bg-white text-gray-500 ring-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {outcomeLabels[o]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmModal
        open={confirmLine !== null}
        title={confirmLine ? `Hapus baris "${confirmLine.description}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={busy}
        onConfirm={performDeleteLine}
        onClose={() => setConfirmLine(null)}
      >
        <p className="text-gray-600">
          Baris rencana akan dihapus. Tindakan ini tidak dapat dibatalkan.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={confirmCancel}
        title="Batalkan rencana ini?"
        description="Status rencana akan menjadi Dibatalkan."
        confirmLabel="Ya, Batalkan"
        busyLabel="Membatalkan…"
        busy={busy}
        onConfirm={() => {
          setConfirmCancel(false);
          return setPlanStatus("cancelled");
        }}
        onClose={() => setConfirmCancel(false)}
      >
        <p className="text-gray-600">
          Rencana yang dibatalkan tidak lagi bisa dijalankan. Tindakan ini tidak
          dapat dibatalkan.
        </p>
      </ConfirmModal>
    </div>
  );
}
