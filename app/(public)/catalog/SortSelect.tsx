"use client";

import { SORT_OPTIONS } from "./sort-options";

/**
 * Sort control for the catalog filter form. Submits the form automatically
 * on change (progressive enhancement — without JS the "Cari" button still
 * applies it).
 */
export default function SortSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select
      name="sort"
      defaultValue={defaultValue}
      onChange={(e) => e.target.form?.requestSubmit()}
      aria-label="Urutkan produk"
      title="Urutkan produk"
      className="cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition hover:border-pink-300 focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
