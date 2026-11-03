"use client";

import type { Category, Product, ProductImage } from "@/lib/types";
import { useInfiniteList } from "./useInfiniteList";

export { useDebouncedValue } from "./useInfiniteList";

export type ProductRow = Product & {
  categories: Pick<Category, "name">;
  product_images: Pick<ProductImage, "image_url" | "sort_order">[];
};

export type ProductFilters = {
  search: string;
  /** Category id, or "all". */
  category: string;
  status: "all" | "active" | "inactive";
};

const PAGE_SIZE = 12;

/**
 * Infinite-scroll data source for the products list — a thin wrapper
 * around the shared useInfiniteList hook (see useInfiniteList.ts for
 * the batching/reset/dedupe semantics).
 */
export function useInfiniteProducts(filters: ProductFilters) {
  return useInfiniteList<ProductRow>(
    "/api/admin/products",
    {
      search: filters.search,
      category: filters.category,
      status: filters.status,
    },
    PAGE_SIZE,
  );
}
