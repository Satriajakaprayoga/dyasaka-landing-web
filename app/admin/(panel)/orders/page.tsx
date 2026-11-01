"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Item, PlanStatus, PurchaseOrder, Supplier } from "@/lib/types";
import {
  Breadcrumbs,
  Card,
  EmptyState,
  OrderStatusBadge,
  Skeleton,
  btnPrimary,
  btnSecondary,
  formatDate,
  formatRupiah,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import {
  CartIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@/components/admin/icons";
import ConfirmModal from "@/components/admin/ConfirmModal";

type CatalogVariant = {
  id: string;
  color: string | null;
  size: string | null;
  current_price: number;
  cost_price: number | null;
  items: { name: string; item_category: string } | null;
};

type CatalogItem = Item & { item_variants: CatalogVariant[] };

// Open plan lines that can be fulfilled by an order (unlinked, on an
// approved/in-progress plan).
type PlanLineOption = {
  id: string;
  description: string;
  quantity: number;
  done_at: string | null;
  plan: { title: string; status: PlanStatus } | null;
};

type ListRow = PurchaseOrder & {
  supplier: { name: string } | null;
  booking: { customer_name: string } | null;
  purchase_order_items: { quantity_ordered: number; unit_cost: number }[];
};

type DraftLine = {
  key: number;
  item_variant_id: string;
  quantity: string;
  unit_cost: string;
  plan_line_id: string;
};

function variantTitle(v: CatalogVariant) {
  const details = [v.color, v.size].filter(Boolean).join(", ");
  const name = v.items?.name ?? "Varian";
  return details ? `${name} (${details})` : name;
}

// ---------- Lines editor (create form) ----------

function LinesEditor({
  lines,
  setLines,
  variantById,
  planOptions,
}: {
  lines: DraftLine[];
  setLines: (next: DraftLine[]) => void;
  variantById: Map<string, CatalogVariant>;
  planOptions: PlanLineOption[];
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; label: string }[]>();
    for (const v of variantById.values()) {
      const category = v.items?.item_category ?? "Lainnya";
      const list = map.get(category) ?? [];
      list.push({ id: v.id, label: variantTitle(v) });
      map.set(category, list);
    }
    return [...map.entries()];
  }, [variantById]);

  function patchLine(key: number, patch: Partial<DraftLine>) {
    setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectVariant(key: number, id: string) {
    // Prefill the planned unit cost: purchase cost first, selling
    // price as a starting point when no cost is recorded yet.
    const v = variantById.get(id);
    patchLine(key, {
      item_variant_id: id,
      unit_cost: v ? String(v.cost_price ?? v.current_price) : "",
    });
  }

  return (
    <div className="space-y-3">
      {lines.map((line, i) => (
        <div
          key={line.key}
          className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1fr_90px_130px_1fr_auto]"
        >
          <div>
            <label className={`${labelClass} text-xs`}>
              Baris {i + 1}
            </label>
            <select
              value={line.item_variant_id}
              onChange={(e) => selectVariant(line.key, e.target.value)}
              className={inputClass}
            >
              <option value="">Pilih varian…</option>
              {groups.map(([category, variants]) => (
                <optgroup key={category} label={category}>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className={`${labelClass} text-xs`}>Jumlah</label>
            <input
              type="number"
              min={1}
              value={line.quantity}
              onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={`${labelClass} text-xs`}>Harga Pokok</label>
            <input
              type="number"
              min={0}
              value={line.unit_cost}
              onChange={(e) => patchLine(line.key, { unit_cost: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={`${labelClass} text-xs`}>
              Dari rencana (opsional)
            </label>
            <select
              value={line.plan_line_id}
              onChange={(e) => patchLine(line.key, { plan_line_id: e.target.value })}
              className={inputClass}
            >
              <option value="">—</option>
              {planOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.description} — {p.plan?.title ?? "Rencana"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
              disabled={lines.length === 1}
              className="rounded-lg px-2 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
              aria-label="Hapus baris"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          setLines([
            ...lines,
            {
              key: Date.now(),
              item_variant_id: "",
              quantity: "1",
              unit_cost: "",
              plan_line_id: "",
            },
          ])
        }
        className={btnSecondary}
      >
        <PlusIcon className="h-4 w-4" />
        Tambah Baris
      </button>
    </div>
  );
}

// ---------- Page ----------

function OrdersInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<ListRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bookings, setBookings] = useState<
    { id: string; customer_name: string; event_date: string }[]
  >([]);
  const [planOptions, setPlanOptions] = useState<PlanLineOption[]>([]);
  const [variantById, setVariantById] = useState<Map<string, CatalogVariant>>(
    new Map(),
  );
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmRow, setConfirmRow] = useState<ListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create form.
  const [creating, setCreating] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    {
      key: 1,
      item_variant_id: "",
      quantity: "1",
      unit_cost: "",
      plan_line_id: "",
    },
  ]);

  useEffect(() => {
    (async () => {
      try {
        const [ordersRes, suppliersRes, bookingsRes, catalogRes, planRes] =
          await Promise.all([
            supabase
              .from("purchase_orders")
              .select(
                "*, supplier:suppliers(name), booking:bookings(customer_name), purchase_order_items(quantity_ordered, unit_cost)",
              )
              .order("created_at", { ascending: false }),
            supabase.from("suppliers").select("*").order("name"),
            supabase
              .from("bookings")
              .select("id, customer_name, event_date")
              .order("event_date", { ascending: false })
              .limit(50),
            supabase
              .from("items")
              .select(
                "id, name, item_category, type, quantity_owned, item_variants(id, color, size, current_price, cost_price)",
              )
              .order("name"),
            supabase
              .from("purchase_plan_lines")
              .select(
                "id, description, quantity, item_variant_id, done_at, plan:purchase_plans(title, status)",
              )
              .is("purchase_order_item_id", null)
              .limit(200),
          ]);

        if (ordersRes.error) throw new Error(ordersRes.error.message);
        if (suppliersRes.error) throw new Error(suppliersRes.error.message);

        setOrders((ordersRes.data ?? []) as unknown as ListRow[]);
        setSuppliers((suppliersRes.data ?? []) as Supplier[]);
        setBookings(bookingsRes.data ?? []);

        // Child→parent embeds come back as objects, not arrays.
        const catalog = (catalogRes.data ?? []) as unknown as CatalogItem[];
        const byId = new Map<string, CatalogVariant>();
        for (const item of catalog) {
          for (const v of item.item_variants) {
            byId.set(v.id, { ...v, items: { name: item.name, item_category: item.item_category } });
          }
        }
        setVariantById(byId);

        const allPlanLines = (planRes.data ?? []) as unknown as PlanLineOption[];
        setPlanOptions(
          allPlanLines.filter(
            (l) =>
              l.done_at == null &&
              (l.plan?.status === "approved" || l.plan?.status === "in_progress"),
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat pesanan");
      } finally {
        setInitialLoading(false);
      }
    })();
    // Prefill runs once (checklist "Buat PO" shortcut lands here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shortcut prefill: ?booking_id=…&item_variant_id=…&quantity=…
  useEffect(() => {
    const variantId = searchParams.get("item_variant_id");
    if (!variantId) return;

    const qty = searchParams.get("quantity") ?? "1";
    setCreating(true);
    setBookingId(searchParams.get("booking_id") ?? "");
    setLines([
      {
        key: 1,
        item_variant_id: variantId,
        quantity: qty,
        unit_cost: "",
        plan_line_id: "",
      },
    ]);
    // Cost prefill once the catalog arrives.
    const v = variantById.get(variantId);
    if (v) {
      setLines((ls) =>
        ls.map((l) =>
          l.key === 1
            ? { ...l, unit_cost: String(v.cost_price ?? v.current_price) }
            : l,
        ),
      );
    }
  }, [searchParams, variantById]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const payload = {
      supplier_id: supplierId,
      booking_id: bookingId || null,
      expected_date: expectedDate || null,
      note: note,
      lines: lines.map((l) => ({
        item_variant_id: l.item_variant_id,
        quantity_ordered: Number(l.quantity),
        unit_cost: l.unit_cost === "" ? 0 : Number(l.unit_cost),
        plan_line_id: l.plan_line_id || null,
      })),
    };

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = `Gagal membuat pesanan (HTTP ${res.status})`;
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
      router.push(`/admin/orders/${body.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat pesanan");
    } finally {
      setSubmitting(false);
    }
  }

  async function performDelete() {
    if (!confirmRow) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/purchase-orders?id=${confirmRow.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        let message = `Gagal menghapus pesanan (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      setOrders((os) => os.filter((o) => o.id !== confirmRow.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus pesanan");
    } finally {
      setConfirmRow(null);
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="mb-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Pembelian" },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Pesanan Pembelian
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Belanja ke supplier — terima barang menambah stok, bayar
              masuk buku kas
            </p>
          </div>
          {!creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={btnPrimary}
            >
              <PlusIcon className="h-4 w-4" />
              Buat Pesanan
            </button>
          )}
        </div>
      </div>

      {creating && (
        <Card className="mb-4 p-4">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="po-supplier" className={labelClass}>
                  Supplier
                </label>
                <select
                  id="po-supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Pilih supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="po-booking" className={labelClass}>
                  Booking (opsional)
                </label>
                <select
                  id="po-booking"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.customer_name} · {formatDate(b.event_date)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="po-expected" className={labelClass}>
                  Target datang
                </label>
                <input
                  id="po-expected"
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="po-note" className={labelClass}>
                Catatan (opsional)
              </label>
              <input
                id="po-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="mis. Ban gudang, tahan lama"
                className={inputClass}
              />
            </div>

            <LinesEditor
              lines={lines}
              setLines={setLines}
              variantById={variantById}
              planOptions={planOptions}
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className={btnSecondary}
              >
                <XIcon className="h-4 w-4" />
                Batal
              </button>
              <button type="submit" disabled={submitting} className={btnPrimary}>
                {submitting ? "Menyimpan…" : "Buat Pesanan"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <Card>
        {initialLoading ? (
          <div className="space-y-4 p-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {orders.map((o) => {
              const total = o.purchase_order_items.reduce(
                (s, it) => s + it.quantity_ordered * Number(it.unit_cost),
                0,
              );
              return (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                        <CartIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {o.supplier?.name ?? "Supplier"}
                          </p>
                          <OrderStatusBadge status={o.status} />
                        </div>
                        <p className="truncate text-xs text-gray-400">
                          {[
                            o.booking?.customer_name
                              ? `Untuk ${o.booking.customer_name}`
                              : null,
                            total > 0 ? formatRupiah(total) : null,
                            o.expected_date
                              ? `Target ${formatDate(o.expected_date)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1">
                      {o.status === "draft" && (
                        <button
                          type="button"
                          onClick={() => setConfirmRow(o)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <ChevronRightIcon className="h-4 w-4 text-gray-300" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="Belum ada pesanan"
            subtitle="Buat pesanan pembelian pertama — atau mulai dari checklist booking."
          />
        )}
      </Card>

      <ConfirmModal
        open={confirmRow !== null}
        title={confirmRow ? `Hapus draft pesanan ke "${confirmRow.supplier?.name ?? "supplier"}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={deleting}
        onConfirm={performDelete}
        onClose={() => setConfirmRow(null)}
      >
        <p className="text-gray-600">
          Semua baris di dalamnya ikut terhapus. Rencana yang tertaut akan
          kembali terbuka. Tindakan ini tidak dapat dibatalkan.
        </p>
      </ConfirmModal>
    </div>
  );
}

export default function OrdersPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <OrdersInner />
    </Suspense>
  );
}
