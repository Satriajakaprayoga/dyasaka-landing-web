import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";

export type GalleryImage = {
  url: string;
  productId: string;
  productName: string;
};

// Fixed aspect cycle — masonry variety without randomness (hydration-safe).
const ASPECTS = ["aspect-[4/3]", "aspect-square", "aspect-[3/4]"] as const;

export function GallerySection({ images }: { images: GalleryImage[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <SectionHeading
        eyebrow="Galeri"
        title="Hasil Karya Kami"
        description="Lihat beberapa dekorasi yang pernah kami pasang — ketuk foto untuk melihat detail paketnya."
      />
      <div className="mt-10 columns-2 gap-4 sm:columns-3 [&>*]:mb-4">
        {images.map((image, index) => (
          <Link
            key={`${image.productId}-${image.url}`}
            href={`/product/${image.productId}`}
            className={`group relative block overflow-hidden rounded-2xl ${ASPECTS[index % ASPECTS.length]}`}
          >
            <Image
              src={image.url}
              alt={image.productName}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
