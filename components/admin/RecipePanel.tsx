"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/types";
import {
  Card,
  btnPrimary,
  btnSecondary,
  formatRupiah,
  inputClass,
  labelClass,
} from "./ui";
import { PlusIcon, TrashIcon } from "./icons";

export type RecipeVariant = {
  color: string | null;
  size: string | null;
  current_price: number;
  items: { name: string } | null;
};

export type RecipeRow = {
  id: string;
  item_variant_id: string;
  quantity: number;
  item_variants: RecipeVariant | null;
};

export type RecipeCatalogVariant = {
  id: string;
  color: string | null;
  size: string | null;
  current_price: number;
};

export type RecipeCatalogItem = Item & {
  item_variants: RecipeCatalogVariant[];
};

function variantLabel(
  itemName: string | undefined,
  color: string | null | undefined,
  size: string | null | undefined,
) {
  const details = [color, size].filter(Boolean).join(", ");
  return details ? `${itemName} (${details})` : (itemName ?? "Varian");
}

// ---------- Add-to-package form ----------

function AddRecipeForm({
  catalog,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  catalog: RecipeCatalogItem[];
  busy: boolean;
  error: string | null;
  onSubmit: (payload: { item_variant_id: string; quantity: number }) => void;
  onCancel: () => void;
}) {
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");

  // Group variants by item_category for the optgroup picker.
  const groups = new Map<string, { id: string; label: string }[]>();
  for (const item of catalog) {
    for (const v of item.item_variants) {
      const list = groups.get(item.item_category) ?? [];
      list.push({
        id: v.id,
        label: `${variantLabel(item.name, v.color, v.size)} — ${formatRupiah(v.current_price)}`,
      });
      groups.set(item.item_category, list);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!variantId) return;
        onSubmit({ item_variant_id: variantId, quantity: Number(quantity) });
      }}
      className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div>
          <label className={labelClass}>Varian</label>
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
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
          <p className="mt-1 text-xs text-gray-400">
            Varian yang sama ditambahkan dua kali akan memperbarui jumlah.
          </p>
        </div>
        <div>
          <label className={labelClass}>Jumlah</label>
          <input
            type="number"
            required
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
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
        <button type="submit" disabled={busy || !variantId} className={btnPrimary}>
          {busy ? "Menyimpan…" : "Tambah ke Paket"}
        </button>
      </div>
    </form>
  );
}

// ---------- Main panel ----------

type Props = {
  productId: string;
  productItems: RecipeRow[];
  catalog: RecipeCatalogItem[];
};

export default function RecipePanel({
  productId,
  productItems,
  catalog,
}: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  // Local editable quantity per row; persisted on blur when changed.
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});

  const catalogById = new Map(
    catalog.flatMap((item) =>
      item.item_variants.map((v) => [
        v.id,
        { name: item.name, type: item.type, variant: v },
      ]),
    ),
  );

  async function handleAdd(payload: {
    item_variant_id: string;
    quantity: number;
  }) {
    setBusy(true);
    setFormError(null);

    const res = await fetch("/api/admin/product-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, ...payload }),
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

  async function handleQuantityCommit(row: RecipeRow) {
    const current = qtyDrafts[row.id];
    if (current === undefined) return;

    const qty = Number(current);
    setQtyDrafts((d) => {
      const next = { ...d };
      delete next[row.id];
      return next;
    });

    if (!Number.isInteger(qty) || qty <= 0 || qty === row.quantity) return;

    setBusy(true);
    setRowError(null);

    const res = await fetch("/api/admin/product-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, quantity: qty }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json();
      setRowError(body.error ?? "Gagal menyimpan jumlah");
      return;
    }

    router.refresh();
  }

  async function handleDelete(row: RecipeRow) {
    const name = variantLabel(
      row.item_variants?.items?.name,
      row.item_variants?.color,
      row.item_variants?.size,
    );
    if (!confirm(`Hapus "${name}" dari paket?`)) return;

    setBusy(true);
    setRowError(null);

    const res = await fetch(`/api/admin/product-items?id=${row.id}`, {
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
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Isi Paket</h2>
          <p className="text-sm text-gray-500">
            Item yang termasuk dalam paket ini (tampil di halaman publik dan
            menjadi isi otomatis setiap booking).
          </p>
        </div>
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
          <AddRecipeForm
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

      {productItems.length === 0 && !creating ? (
        <Card>
          <div className="py-10 text-center text-sm text-gray-500">
            Belum ada item dalam paket.
          </div>
        </Card>
      ) : (
        productItems.length > 0 && (
          <Card className="divide-y divide-gray-100">
            {productItems.map((row) => {
              const meta = catalogById.get(row.item_variant_id);
              const name = variantLabel(
                row.item_variants?.items?.name ?? meta?.name,
                row.item_variants?.color,
                row.item_variants?.size,
              );
              const price =
                row.item_variants?.current_price ?? meta?.variant.current_price ?? 0;
              const isRentable = meta?.type === "rentable";
              const draft = qtyDrafts[row.id];

              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{name}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      Harga ref: {formatRupiah(price)}
                      {isRentable ? " · Sewa" : " · Habis Pakai"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-500">
                      Jumlah
                      <input
                        type="number"
                        min={1}
                        value={draft ?? String(row.quantity)}
                        onChange={(e) =>
                          setQtyDrafts((d) => ({
                            ...d,
                            [row.id]: e.target.value,
                          }))
                        }
                        onBlur={() => handleQuantityCommit(row)}
                        className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </label>
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
              );
            })}
          </Card>
        )
      )}
    </div>
  );
}
