import Image from "next/image";
import Link from "next/link";
import { BalloonIcon } from "@/components/BalloonIcon";
import type { Category, ProductImage } from "@/lib/types";

export type LandingProduct = {
  id: string;
  name: string;
  price: number;
  product_images: Pick<ProductImage, "image_url" | "sort_order">[];
  categories: Pick<Category, "name"> | null;
};

export function ProductCard({
  product,
  priority = false,
}: {
  product: LandingProduct;
  priority?: boolean;
}) {
  const cover = [...product.product_images].sort(
    (a, b) => a.sort_order - b.sort_order,
  )[0];
  return (
    <Link
      href={`/product/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-pink-50">
        {cover ? (
          <Image
            src={cover.image_url}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-pink-300">
            <BalloonIcon className="h-10 w-10" />
            <span className="text-xs">Tanpa foto</span>
          </div>
        )}
      </div>
      <div className="space-y-1 p-4">
        {product.categories?.name && (
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
            {product.categories.name}
          </p>
        )}
        <h3 className="line-clamp-2 font-semibold leading-snug text-gray-900 transition group-hover:text-pink-600">
          {product.name}
        </h3>
        <p className="pt-1 font-bold text-pink-600">
          Rp {product.price.toLocaleString("id-ID")}
        </p>
      </div>
    </Link>
  );
}
