import Link from "next/link";
import { BalloonIcon } from "@/components/BalloonIcon";
import { SectionHeading } from "./SectionHeading";
import type { Category } from "@/lib/types";

const TINTS = ["bg-pink-50", "bg-rose-50", "bg-amber-50", "bg-sky-50"] as const;

export function CategoryShowcase({ categories }: { categories: Category[] }) {
  return (
    <section className="bg-gradient-to-b from-white to-pink-50/50 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading
          eyebrow="Kategori"
          title="Dekorasi untuk Setiap Acara"
          description="Dari ulang tahun hingga pernikahan — pilih kategori yang sesuai dengan momen Anda."
        />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/catalog?category=${category.id}`}
              className={`${
                TINTS[index % TINTS.length]
              } group flex flex-col items-center gap-3 rounded-2xl border border-transparent px-4 py-8 text-center transition duration-200 hover:-translate-y-1 hover:border-pink-300 hover:shadow-lg`}
            >
              <BalloonIcon className="h-10 w-10 text-pink-400 transition duration-300 group-hover:scale-110" />
              <span className="font-semibold text-gray-900 transition group-hover:text-pink-600">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
