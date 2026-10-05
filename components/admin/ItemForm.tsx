"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Item, ItemType } from "@/lib/types";
import {
  Card,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from "./ui";
import { PlusIcon } from "./icons";

type Props = {
  itemCategories: string[];
  item?: Item;
};

const typeOptions: { value: ItemType; label: string; hint: string }[] = [
  {
    value: "consumable",
    label: "Habis Pakai",
    hint: "Stok berkurang saat dipakai booking (balon, kartu ucapan, dll.)",
  },
  {
    value: "rentable",
    label: "Sewa",
    hint: "Dipinjam dan dikembalikan (stand, backdrop, dll.)",
  },
];

export default function ItemForm({ itemCategories, item }: Props) {
  const router = useRouter();
  const isEdit = Boolean(item);

  const [form, setForm] = useState({
    name: item?.name ?? "",
    item_category: item?.item_category ?? "",
    type: (item?.type ?? "consumable") as ItemType,
    pieces_per_unit: item?.pieces_per_unit ? String(item.pieces_per_unit) : "",
    quantity_owned: item ? String(item.quantity_owned) : "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      name: form.name,
      item_category: form.item_category,
      type: form.type,
      pieces_per_unit: form.pieces_per_unit ? Number(form.pieces_per_unit) : null,
      quantity_owned: form.type === "rentable" ? Number(form.quantity_owned) : 0,
    };

    const res = await fetch("/api/admin/items", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { id: item!.id, ...payload } : payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Gagal menyimpan item");
      return;
    }

    router.push("/admin/items");
    router.refresh();
  }

  const activeHint =
    typeOptions.find((t) => t.value === form.type)?.hint ?? "";

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelClass}>Nama Item</label>
          <input
            type="text"
            required
            placeholder="mis. Balon Latex, Arch Stand"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Kategori Item</label>
          <input
            type="text"
            required
            list="item-category-options"
            placeholder="mis. Balloon, Stand Decoration"
            value={form.item_category}
            onChange={(e) => update("item_category", e.target.value)}
            className={inputClass}
          />
          <datalist id="item-category-options">
            {itemCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-gray-400">
            Kategori item terpisah dari kategori produk — pilih yang sudah ada
            atau ketik baru.
          </p>
        </div>

        <div>
          <label className={labelClass}>Tipe</label>
          <div className="grid grid-cols-2 gap-2">
            {typeOptions.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => update("type", t.value)}
                className={
                  "rounded-lg border px-3 py-2 text-sm font-medium transition " +
                  (form.type === t.value
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">{activeHint}</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Pieces per Unit (opsional)</label>
            <input
              type="number"
              min={0}
              value={form.pieces_per_unit}
              onChange={(e) => update("pieces_per_unit", e.target.value)}
              className={inputClass}
              placeholder="mis. 6"
            />
            <p className="mt-1 text-xs text-gray-400">
              Informasional — mis. 1 unit stand terdiri dari 6 piece.
            </p>
          </div>
          {form.type === "rentable" && (
            <div>
              <label className={labelClass}>Quantity Owned</label>
              <input
                type="number"
                required
                min={0}
                value={form.quantity_owned}
                onChange={(e) => update("quantity_owned", e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-400">
                Jumlah unit sewa utuh yang dimiliki.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={() => router.push("/admin/items")}
            className={btnSecondary}
          >
            Batal
          </button>
          <button type="submit" disabled={submitting} className={btnPrimary}>
            <PlusIcon className="h-4 w-4" />
            {submitting ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Simpan Item"}
          </button>
        </div>
      </form>
    </Card>
  );
}
