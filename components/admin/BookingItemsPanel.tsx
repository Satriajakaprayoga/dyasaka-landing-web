"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingItem, Item } from "@/lib/types";
import {
  Card,
  RentalStatusBadge,
  btnPrimary,
  btnSecondary,
  formatDateTime,
  formatRupiah,
  inputClass,
} from "./ui";
import { PlusIcon, TrashIcon } from "./icons";

export type BookingItemVariant = {
  color: string | null;
  size: string | null;
  items: { name: string; type: string; quantity_owned: number } | null;
};

export type BookingItemRow = BookingItem & {
  item_variants: BookingItemVariant | null;
};

export type BookingCatalogVariant = {
  id: string;
  color: string | null;
  size: string | null;
  current_price: number;
};

export type BookingCatalogItem = Item & {
  item_variants: BookingCatalogVariant[];
};

function variantTitle(
  itemName: string | undefined,
  color: string | null | undefined,
  size: string | null | undefined,
) {
  const details = [color, size].filter(Boolean).join(", ");
  return details ? `${itemName} (${details})` : (itemName ?? "Varian");
}

// ---------- Add-item form ----------

function AddBookingItemForm({
  bookingId,
  catalog,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  bookingId: string;
  catalog: BookingCatalogItem[];
  busy: boolean;
  error: string | null;
  onSubmit: (payload: {
    booking_id: string;
    item_variant_id: string;
    quantity: number;
    unit_price?: number;
  }) => void;
  onCancel: () => void;
}) {
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");

  const variantById = new Map(
    catalog.flatMap((item) =>
      item.item_variants.map((v) => [
        v.id,
        { item, variant: v },
      ]),
    ),
  );

  function selectVariant(id: string) {
    setVariantId(id);
    const found = variantById.get(id);
    setPrice(found ? String(found.variant.current_price) : "");
  }

  const groups = new Map<string, { id: string; label: string }[]>();
  for (const item of catalog) {
    for (const v of item.item_variants) {
      const list = groups.get(item.item_category) ?? [];
      list.push({
        id: v.id,
        label: `${variantTitle(item.name, v.color, v.size)} — ${formatRupiah(v.current_price)}`,
      });
      groups.set(item.item_category, list);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!variantId) return;
        onSubmit({
          booking_id: bookingId,
          item_variant_id: variantId,
          quantity: Number(quantity),
          ...(price !== "" ? { unit_price: Number(price) } : {}),
        });
      }}
      className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_100px_140px]">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Varian
          </label>
          <select
            value={variantId}
            onChange={(e) => selectVariant(e.target.value)}
            className={inputClass}
          >
            <option value="">Pilih varian…</option>
            {[...groups.entries()].map(([category, variants]) => (
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Jumlah
          </label>
          <input
            type="number"
            required
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Harga Satuan (Rp)
          </label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
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
        <button
          type="submit"
          disabled={busy || !variantId}
          className={btnPrimary}
        >
          {busy ? "Menyimpan…" : "Tambah Item"}
        </button>
      </div>
    </form>
  );
}

// ---------- Main panel ----------

type Props = {
  bookingId: string;
  items: BookingItemRow[];
  catalog: BookingCatalogItem[];
  /** Confirmed same-date demand per variant (excluding this booking). */
  demand: Record<string, number>;
};

export default function BookingItemsPanel({
  bookingId,
  items,
  catalog,
  demand,
}: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  // Per-row editable drafts (qty/price), persisted on blur when changed.
  const [drafts, setDrafts] = useState<
    Record<string, { quantity?: string; unit_price?: string }>
  >({});

  const catalogById = new Map(
    catalog.flatMap((item) =>
      item.item_variants.map((v) => [
        v.id,
        { item, variant: v },
      ]),
    ),
  );

  function setDraft(id: string, key: "quantity" | "unit_price", value: string) {
    setDrafts((d) => ({
      ...d,
      [id]: { ...d[id], [key]: value },
    }));
  }

  async function handleAdd(payload: Record<string, unknown>) {
    setBusy(true);
    setFormError(null);

    const res = await fetch("/api/admin/booking-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      setFormError(body.error ?? "Gagal menambah item");
      return;
    }

    setCreating(false);
    router.refresh();
  }

  async function handleBlurCommit(
    row: BookingItemRow,
    key: "quantity" | "unit_price",
  ) {
    const raw = drafts[row.id]?.[key];
    if (raw === undefined) return;

    setDrafts((d) => {
      const next = { ...d };
      const entry = { ...next[row.id] };
      delete entry[key];
      if (Object.keys(entry).length === 0) delete next[row.id];
      next[row.id] = entry;
      return next;
    });

    const value = Number(raw);
    if (key === "quantity") {
      if (!Number.isInteger(value) || value <= 0 || value === row.quantity)
        return;
    } else {
      if (Number.isNaN(value) || value < 0 || value === row.unit_price) return;
    }

    setBusy(true);
    setRowError(null);

    const res = await fetch("/api/admin/booking-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, [key]: value }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      setRowError(body.error ?? "Gagal menyimpan perubahan");
      return;
    }

    router.refresh();
  }

  async function handleDelete(row: BookingItemRow) {
    const name = variantTitle(
      row.item_variants?.items?.name,
      row.item_variants?.color,
      row.item_variants?.size,
    );
    if (
      !confirm(
        `Hapus "${name}" dari booking ini? Baris checklist terkait juga akan terhapus.`,
      )
    )
      return;

    setBusy(true);
    setRowError(null);

    const res = await fetch(`/api/admin/booking-items?id=${row.id}`, {
      method: "DELETE",
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      setRowError(body.error ?? "Gagal menghapus item");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Item Booking</h2>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={btnPrimary}
          >
            <PlusIcon className="h-4 w-4" />
            Tambah Item
          </button>
        )}
      </div>

      {creating && (
        <Card className="p-4">
          <AddBookingItemForm
            bookingId={bookingId}
            catalog={catalog}
            busy={busy}
            error={formError}
            onSubmit={handleAdd}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      {rowError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {rowError}
        </p>
      )}

      {items.length === 0 && !creating ? (
        <Card>
          <div className="py-10 text-center text-sm text-gray-500">
            Belum ada item. Tambahkan item manual untuk booking custom.
          </div>
        </Card>
      ) : (
        items.length > 0 && (
          <Card className="divide-y divide-gray-100">
            {items.map((row) => {
              const v = row.item_variants;
              const isRentable = v?.items?.type === "rentable";
              const owned = v?.items?.quantity_owned ?? 0;
              const otherDemand = demand[row.item_variant_id] ?? 0;
              const available = owned - otherDemand;
              const overDemanded = isRentable && row.quantity > available;
              const qtyDraft = drafts[row.id]?.quantity;
              const priceDraft = drafts[row.id]?.unit_price;

              return (
                <div key={row.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {variantTitle(v?.items?.name, v?.color, v?.size)}
                        </p>
                        {isRentable && row.rental_status && (
                          <RentalStatusBadge status={row.rental_status} />
                        )}
                      </div>
                      {isRentable && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          {row.checked_out_at &&
                            `Keluar: ${formatDateTime(row.checked_out_at)} · `}
                          {row.returned_at &&
                            `Kembali: ${formatDateTime(row.returned_at)}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm tabular-nums">
                        <p className="font-semibold text-gray-900">
                          {formatRupiah(row.quantity * row.unit_price)}
                        </p>
                        <p className="text-xs text-gray-400">subtotal</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <label className="flex items-center gap-2">
                      Jumlah
                      <input
                        type="number"
                        min={1}
                        value={qtyDraft ?? String(row.quantity)}
                        onChange={(e) =>
                          setDraft(row.id, "quantity", e.target.value)
                        }
                        onBlur={() => handleBlurCommit(row, "quantity")}
                        className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      Harga
                      <input
                        type="number"
                        min={0}
                        value={priceDraft ?? String(row.unit_price)}
                        onChange={(e) =>
                          setDraft(row.id, "unit_price", e.target.value)
                        }
                        onBlur={() => handleBlurCommit(row, "unit_price")}
                        className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </label>
                  </div>

                  {overDemanded && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Melebihi ketersediaan: butuh {row.quantity}, tersedia{" "}
                      {available} di tanggal ini ({owned} dimiliki,{" "}
                      {otherDemand} dipakai booking lain). Tidak diblokir —
                      tinjau stok atau sewa tambahan.
                    </p>
                  )}
                </div>
              );
            })}
          </Card>
        )
      )}
    </div>
  );
}
