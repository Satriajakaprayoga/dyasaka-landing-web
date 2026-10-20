"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ItemPriceHistory,
  ItemVariant,
  StockMovement,
  StockMovementType,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import {
  Badge,
  Card,
  btnPrimary,
  btnSecondary,
  formatDateTime,
  formatRupiah,
  inputClass,
  labelClass,
} from "./ui";
import ConfirmModal, {
  ImpactBookingList,
  ImpactProductList,
  type ImpactBookingRef,
  type ImpactProductRef,
} from "./ConfirmModal";
import { PencilIcon, PlusIcon, TrashIcon } from "./icons";

type Impact = {
  blocked: boolean;
  lines: { text: string; danger: boolean }[];
  bookingRefs: ImpactBookingRef[];
  productRefs: ImpactProductRef[];
};

const movementTypeLabels: Record<StockMovementType, string> = {
  restock: "Restock",
  usage: "Pemakaian",
  damaged: "Rusak",
  lost: "Hilang",
  adjustment: "Penyesuaian",
  purchased: "Pembelian",
};

const movementTypeOrder: StockMovementType[] = [
  "restock",
  "purchased",
  "usage",
  "damaged",
  "lost",
  "adjustment",
];

function quantityHint(type: StockMovementType) {
  if (type === "restock" || type === "purchased") return "positif (+)";
  if (type === "usage" || type === "damaged" || type === "lost")
    return "negatif (−)";
  return "positif atau negatif (+/−)";
}

function isLowStock(v: ItemVariant) {
  return v.reorder_point != null && v.stock_quantity <= v.reorder_point;
}

function variantTitle(v: ItemVariant) {
  const parts = [v.color, v.size].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : v.sku || "Varian";
}

// ---------- Variant create/edit form ----------

function VariantForm({
  initial,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: ItemVariant;
  busy: boolean;
  error: string | null;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    color: initial?.color ?? "",
    size: initial?.size ?? "",
    sku: initial?.sku ?? "",
    stock_quantity: initial ? String(initial.stock_quantity) : "0",
    current_price: initial ? String(initial.current_price) : "",
    reorder_point:
      initial?.reorder_point != null ? String(initial.reorder_point) : "",
  });

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          ...(isEdit ? {} : { stock_quantity: Number(form.stock_quantity) }),
          color: form.color,
          size: form.size,
          sku: form.sku,
          current_price: Number(form.current_price),
          reorder_point: form.reorder_point ? Number(form.reorder_point) : null,
        });
      }}
      className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Warna</label>
          <input
            type="text"
            placeholder="mis. Merah"
            value={form.color}
            onChange={(e) => update("color", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Ukuran</label>
          <input
            type="text"
            placeholder="mis. 12 inci"
            value={form.size}
            onChange={(e) => update("size", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>SKU (opsional)</label>
          <input
            type="text"
            value={form.sku}
            onChange={(e) => update("sku", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Harga Saat Ini (Rp)</label>
          <input
            type="number"
            required
            min={0}
            value={form.current_price}
            onChange={(e) => update("current_price", e.target.value)}
            className={inputClass}
          />
          {isEdit && (
            <p className="mt-1 text-xs text-gray-400">
              Perubahan harga dicatat ke riwayat harga.
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>Reorder Point (opsional)</label>
          <input
            type="number"
            min={0}
            value={form.reorder_point}
            onChange={(e) => update("reorder_point", e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400">
            Peringatan stok rendah saat stok ≤ nilai ini.
          </p>
        </div>
        {!isEdit && (
          <div>
            <label className={labelClass}>Stok Awal</label>
            <input
              type="number"
              min={0}
              value={form.stock_quantity}
              onChange={(e) => update("stock_quantity", e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">
              Tercatat sebagai movement &quot;Stok awal&quot;.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Batal
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Menyimpan…" : isEdit ? "Simpan Varian" : "Tambah Varian"}
        </button>
      </div>
    </form>
  );
}

// ---------- Stock movement form ----------

function MovementForm({
  onSubmit,
  onCancel,
  busy,
  error,
}: {
  onSubmit: (payload: {
    type: StockMovementType;
    quantity: number;
    note: string;
  }) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [type, setType] = useState<StockMovementType>("restock");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ type, quantity: Number(quantity), note });
      }}
      className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Jenis</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as StockMovementType)}
            className={inputClass}
          >
            {movementTypeOrder.map((t) => (
              <option key={t} value={t}>
                {movementTypeLabels[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Jumlah</label>
          <input
            type="number"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
            placeholder={quantityHint(type)}
          />
        </div>
        <div>
          <label className={labelClass}>Catatan (opsional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
            placeholder="mis. dari supplier"
          />
        </div>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Batal
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Menyimpan…" : "Catat Movement"}
        </button>
      </div>
    </form>
  );
}

// ---------- Main panel ----------

type Props = {
  itemId: string;
  variants: ItemVariant[];
  movements: StockMovement[];
  priceHistory: ItemPriceHistory[];
};

export default function VariantsPanel({
  itemId,
  variants,
  movements,
  priceHistory,
}: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVariant, setConfirmVariant] = useState<ItemVariant | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);

  async function handleCreate(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/item-variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, ...payload }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal menambah varian");
      return;
    }

    setCreating(false);
    router.refresh();
  }

  async function handleUpdate(id: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/item-variants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal menyimpan varian");
      return;
    }

    setEditingId(null);
    router.refresh();
  }

  // A variant is RESTRICT-referenced by four tables; any of them blocks.
  // Referencing bookings/products are fetched as details so the modal can
  // link to them for inspection before the admin resolves the blockers.
  async function computeImpact(v: ItemVariant): Promise<Impact> {
    const [priceHistory, movements, recipeRows, bookingItemRows] =
      await Promise.all([
        supabase
          .from("item_price_history")
          .select("id", { count: "exact", head: true })
          .eq("item_variant_id", v.id),
        supabase
          .from("stock_movements")
          .select("id", { count: "exact", head: true })
          .eq("item_variant_id", v.id),
        supabase
          .from("product_items")
          .select("product_id, products(id, name)")
          .eq("item_variant_id", v.id),
        supabase
          .from("booking_items")
          .select("booking_id, bookings(customer_name, event_date)")
          .eq("item_variant_id", v.id),
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
    if ((recipeRows.data ?? []).length > 0)
      blockers.push(`${(recipeRows.data ?? []).length} baris resep produk`);
    if ((bookingItemRows.data ?? []).length > 0)
      blockers.push(`${(bookingItemRows.data ?? []).length} item booking`);

    if (blockers.length === 0) {
      return {
        blocked: false,
        lines: [{ text: "Tidak ada data terkait — aman untuk dihapus.", danger: false }],
        bookingRefs: [],
        productRefs: [],
      };
    }

    return {
      blocked: true,
      lines: [
        {
          text: `Varian masih dipakai (${blockers.join(", ")}) — hapus data terkait terlebih dahulu.`,
          danger: true,
        },
      ],
      bookingRefs,
      productRefs,
    };
  }

  function closeConfirm() {
    setConfirmVariant(null);
    setImpact(null);
  }

  async function handleDeleteClick(v: ItemVariant) {
    setConfirmVariant(v);
    setImpact(null);
    setImpact(await computeImpact(v));
  }

  async function performDelete() {
    if (!confirmVariant) return;

    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/item-variants?id=${confirmVariant.id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const body = await res.json();
      closeConfirm();
      setBusy(false);
      setError(
        body.error ??
          "Gagal menghapus varian (masih dipakai di riwayat, resep, atau booking)",
      );
      return;
    }

    closeConfirm();
    setBusy(false);
    router.refresh();
  }

  async function handleMovement(
    variantId: string,
    payload: { type: StockMovementType; quantity: number; note: string },
  ) {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/admin/stock-movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_variant_id: variantId, ...payload }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal mencatat movement");
      return;
    }

    setMovingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Varian</h2>
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className={btnPrimary}
          >
            <PlusIcon className="h-4 w-4" />
            Tambah Varian
          </button>
        )}
      </div>

      {error && !creating && !editingId && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {creating && (
        <Card className="p-4">
          <VariantForm
            busy={busy}
            error={error}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      {variants.length === 0 && !creating ? (
        <Card>
          <div className="py-10 text-center text-sm text-gray-500">
            Belum ada varian. Tambahkan varian untuk mengatur harga & stok.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {variants.map((v) => {
            const vMovements = movements.filter(
              (m) => m.item_variant_id === v.id,
            );
            const vPrices = priceHistory.filter(
              (p) => p.item_variant_id === v.id,
            );
            const hasHistory = vMovements.length > 0 || vPrices.length > 0;

            return (
              <Card key={v.id} className="p-4">
                {editingId === v.id ? (
                  <VariantForm
                    initial={v}
                    busy={busy}
                    error={error}
                    onSubmit={(payload) => handleUpdate(v.id, payload)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {variantTitle(v)}
                          </p>
                          {isLowStock(v) && (
                            <Badge tone="red">Stok rendah</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {v.sku ? `SKU: ${v.sku} · ` : ""}
                          {v.reorder_point != null
                            ? `Reorder point: ${v.reorder_point}`
                            : "Tanpa reorder point"}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-gray-900">
                            {formatRupiah(v.current_price)}
                          </p>
                          <p
                            className={
                              "text-sm tabular-nums " +
                              (isLowStock(v)
                                ? "font-medium text-red-600"
                                : "text-gray-500")
                            }
                          >
                            Stok: {v.stock_quantity}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMovingId(movingId === v.id ? null : v.id);
                              setEditingId(null);
                            }}
                            className={
                              "rounded-lg px-2.5 py-1.5 text-sm font-medium transition " +
                              (movingId === v.id
                                ? "bg-gray-900 text-white"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")
                            }
                          >
                            Stok
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(v.id);
                              setCreating(false);
                              setMovingId(null);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(v)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {movingId === v.id && (
                      <MovementForm
                        busy={busy}
                        error={error}
                        onSubmit={(payload) => handleMovement(v.id, payload)}
                        onCancel={() => setMovingId(null)}
                      />
                    )}

                    {hasHistory && (
                      <details className="mt-3 border-t border-gray-100 pt-3">
                        <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-900">
                          Riwayat ({vMovements.length} movement ·{" "}
                          {vPrices.length} perubahan harga)
                        </summary>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-gray-400">
                              PERGERAKAN STOK
                            </p>
                            <ul className="space-y-1">
                              {vMovements.map((m) => (
                                <li
                                  key={m.id}
                                  className="flex items-center justify-between gap-2 text-xs"
                                >
                                  <span className="text-gray-600">
                                    {movementTypeLabels[m.type]}
                                    {m.note ? ` · ${m.note}` : ""}
                                  </span>
                                  <span
                                    className={
                                      "shrink-0 font-medium tabular-nums " +
                                      (m.quantity > 0
                                        ? "text-green-600"
                                        : "text-red-600")
                                    }
                                  >
                                    {m.quantity > 0 ? "+" : ""}
                                    {m.quantity}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-gray-400">
                              RIWAYAT HARGA
                            </p>
                            <ul className="space-y-1">
                              {vPrices.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex items-center justify-between gap-2 text-xs"
                                >
                                  <span className="tabular-nums text-gray-600">
                                    {formatRupiah(p.price)}
                                  </span>
                                  <span className="shrink-0 text-gray-400">
                                    {formatDateTime(p.effective_from)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </details>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={confirmVariant !== null}
        title={confirmVariant ? `Hapus varian "${variantTitle(confirmVariant)}"?` : ""}
        description="Tindakan ini tidak dapat dibatalkan."
        busy={busy}
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
