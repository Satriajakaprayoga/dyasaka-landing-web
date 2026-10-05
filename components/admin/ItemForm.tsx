"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Item, ItemType } from "@/lib/types";
import {
  Card,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from "./ui";
import { ChevronDownIcon, PlusIcon } from "./icons";

type CategorySuggestion = {
  name: string;
  count: number;
};

type Props = {
  itemCategories: CategorySuggestion[];
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

function highlightMatch(name: string, query: string) {
  const idx = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <span className="font-semibold text-gray-900">
        {name.slice(idx, idx + query.length)}
      </span>
      {name.slice(idx + query.length)}
    </>
  );
}

// ---------- Category autocomplete (replaces native datalist) ----------

function CategoryCombobox({
  suggestions,
  value,
  onChange,
}: {
  suggestions: CategorySuggestion[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = value.trim();
  const queryLower = query.toLowerCase();
  const matches = (
    queryLower
      ? suggestions.filter((s) => s.name.toLowerCase().includes(queryLower))
      : suggestions
  ).slice(0, 8);
  const hasExact = suggestions.some(
    (s) => s.name.toLowerCase() === queryLower,
  );
  const showCreate = queryLower !== "" && !hasExact;
  const rowCount = matches.length + (showCreate ? 1 : 0);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function select(name: string) {
    onChange(name);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (rowCount > 0) setActiveIndex((i) => (i + 1) % rowCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowCount > 0)
        setActiveIndex((i) => (i - 1 + rowCount) % rowCount);
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0) {
        e.preventDefault();
        if (activeIndex < matches.length) {
          select(matches[activeIndex].name);
        } else {
          select(query);
        }
      }
      // otherwise: dropdown closed or nothing highlighted → submit form
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        required
        role="combobox"
        aria-expanded={open}
        aria-controls="item-category-listbox"
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="mis. Balloon, Stand Decoration"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={inputClass + " pr-9"}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Buka saran kategori"
        onClick={() => setOpen((o) => !o)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 transition hover:text-gray-600"
      >
        <ChevronDownIcon
          className={"h-4 w-4 transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {rowCount === 0 ? (
            <p className="px-3 py-2.5 text-sm text-gray-400">
              Belum ada kategori — ketik untuk membuat baru.
            </p>
          ) : (
            <ul
              id="item-category-listbox"
              role="listbox"
              className="max-h-56 overflow-y-auto py-1"
            >
              {matches.map((s, i) => (
                <li key={s.name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === s.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(s.name)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm " +
                      (activeIndex === i
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-700")
                    }
                  >
                    <span className="truncate">
                      {highlightMatch(s.name, query)}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {s.count} item
                    </span>
                  </button>
                </li>
              ))}
              {showCreate && (
                <li className="border-t border-gray-100">
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(query)}
                    onMouseEnter={() => setActiveIndex(matches.length)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <PlusIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="truncate">
                      Buat baru: &quot;{query}&quot;
                    </span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

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
          <CategoryCombobox
            suggestions={itemCategories}
            value={form.item_category}
            onChange={(value) => update("item_category", value)}
          />
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
