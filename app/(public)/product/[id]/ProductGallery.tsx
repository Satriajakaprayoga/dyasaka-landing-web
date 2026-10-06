"use client";

import Image from "next/image";
import { useState } from "react";
import { BalloonIcon } from "@/components/BalloonIcon";

type GalleryImage = { id: string; image_url: string };

/**
 * Product photo gallery: large main image with a thumbnail strip to
 * switch photos. The first image renders on the server (priority), and
 * switching is instant client state — no fetch involved.
 */
export default function ProductGallery({
  name,
  images,
}: {
  name: string;
  images: GalleryImage[];
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-pink-50 text-pink-300">
        <BalloonIcon className="h-14 w-14" />
        <span className="text-sm">Belum ada foto</span>
      </div>
    );
  }

  const index = Math.min(active, images.length - 1);
  const current = images[index];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-pink-50">
        <Image
          key={current.id}
          src={current.image_url}
          alt={`Foto ${index + 1} — ${name}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white">
            {index + 1} / {images.length}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div
          className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6"
          role="tablist"
          aria-label="Foto produk"
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Lihat foto ${i + 1}`}
              onClick={() => setActive(i)}
              className={`relative aspect-square overflow-hidden rounded-xl border-2 transition ${
                i === index
                  ? "border-pink-600 opacity-100"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image src={img.image_url} alt="" fill sizes="120px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
