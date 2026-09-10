"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";
import Link from "next/link";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState(false);

  async function handleRemoveCategory(e: string) {
    setLoadingRemove(true);
    const { error } = await supabase.from("categories").delete().eq("id", e);

    setLoadingRemove(false);

    if (error) {
      const body = error.message;
      setError(body ?? "Failed to remove category");
      return;
    }

    loadCategories();
  }
  async function loadCategories() {
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("name");
    setCategories((data ?? []) as Category[]);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to create category");
      return;
    }

    setName("");
    loadCategories();
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8">
      <div className="p-3 flex justify-between">
        <h1 className="text-xl font-semibold mb-6">Kategori</h1>

        <Link
          href={"/admin"}
          className="border rounded-lg p-2 hover:shadow-md text-sm transition flex align-middle items-center text-center justify-center"
        >
          Kembali
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Nama kategori baru"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-pink-600 text-white rounded px-4 py-2 font-medium hover:bg-pink-700 transition disabled:opacity-50"
        >
          Tambah
        </button>
      </form>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <ul className="border rounded-lg divide-y">
        {categories.map((c) => (
          <li key={c.id} className="p-3 flex justify-between">
            <span>{c.name}</span>
            <button
              className="bg-red-400 rounded  px-2 font-medium hover:bg-red-300"
              onClick={() => handleRemoveCategory(c.id)}
              disabled={loadingRemove}
            >
              Hapus
            </button>
          </li>
        ))}
        {categories.length === 0 && (
          <li className="p-6 text-center text-gray-400">Belum ada kategori.</li>
        )}
      </ul>
    </main>
  );
}
