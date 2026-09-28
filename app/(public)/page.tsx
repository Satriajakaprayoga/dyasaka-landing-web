import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-16 text-center">
      <h1 className="text-3xl sm:text-4xl font-semibold mb-4">
        Dekorasi Balon untuk Momen Spesial Anda 🎈
      </h1>
      <p className="text-gray-500 mb-8 max-w-xl mx-auto">
        Ulang tahun, pernikahan, baby shower, atau acara kantor — kami bantu
        wujudkan dekorasi balon impian Anda.
      </p>
      <div className="flex gap-3 justify-center">
        <Link
          href="/catalog"
          className="bg-pink-600 text-white rounded-lg px-6 py-3 font-medium hover:bg-pink-700 transition"
        >
          Lihat Katalog
        </Link>
        <Link
          href="/availability"
          className="border rounded-lg px-6 py-3 font-medium hover:bg-gray-50 transition"
        >
          Cek Ketersediaan
        </Link>
      </div>
    </main>
  );
}
