import Link from "next/link";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="text-5xl" aria-hidden="true">
        🎈
      </span>
      <h1 className="mt-4 text-xl font-semibold text-gray-900">
        Anda sedang offline
      </h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Koneksi internet tidak tersedia. Halaman yang pernah dibuka tetap bisa
        diakses dari cache.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        Coba Lagi
      </Link>
    </main>
  );
}
