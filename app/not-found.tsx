import Link from "next/link";

export const metadata = {
  title: "Halaman tidak ditemukan — Dyasaka Decoration",
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <span className="text-5xl" aria-hidden="true">
        🎈
      </span>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Tautan yang Anda buka mungkin sudah dipindahkan atau tidak pernah ada.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-700"
        >
          Kembali ke Beranda
        </Link>
        <Link
          href="/catalog"
          className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:border-pink-300 hover:text-pink-600"
        >
          Lihat Katalog
        </Link>
      </div>
    </main>
  );
}
