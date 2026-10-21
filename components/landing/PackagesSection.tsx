import Link from "next/link";
import { SectionHeading } from "./SectionHeading";
import { ProductCard, type LandingProduct } from "./ProductCard";

export function PackagesSection({ products }: { products: LandingProduct[] }) {
  return (
    <section id="paket" className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <SectionHeading
        eyebrow="Paket Kami"
        title="Pilihan Paket Dekorasi Favorit"
        description="Koleksi paket dekorasi balon paling sering dipesan untuk berbagai acara spesial."
      />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product, index) => (
          <ProductCard key={product.id} product={product} priority={index < 2} />
        ))}
      </div>
      <div className="mt-10 text-center">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 font-semibold text-pink-600 transition hover:text-pink-700"
        >
          Lihat semua paket <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </section>
  );
}
