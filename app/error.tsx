"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <span className="text-5xl" aria-hidden="true">
        🎈
      </span>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        Ada yang tidak berjalan lancar
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Halaman gagal dimuat. Coba muat ulang; jika masih gagal, hubungi admin
        via WhatsApp.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
      >
        Coba lagi
      </button>
    </main>
  );
}
