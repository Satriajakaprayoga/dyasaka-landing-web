"use server";

import { revalidatePath, revalidateTag } from "next/cache";

/**
 * On-demand purge of every publicly cached page / query that renders
 * product / category / recipe data. The public pages have NO
 * time-based revalidate — they stay cached until this runs, so there
 * is no staleness window: a page regenerates only right after an
 * admin mutation changed what it shows.
 *
 * Route handlers call this after successful writes (products,
 * categories, recipes, item/variant edits). Client code calls it too —
 * product photos are written through the browser supabase client in
 * ProductForm, not through an API route.
 */
export async function revalidatePublicCatalog() {
  // Landing: featured products, category showcase, photo gallery.
  revalidatePath("/", "page");
  // Every product detail page (dynamic-segment pattern form).
  revalidatePath("/product/[id]", "page");
  // /catalog itself renders per request (searchParams), but its DB
  // queries are cached in the Data Cache (unstable_cache in
  // catalog/page.tsx) — drop every cached filter combination so the
  // next render re-queries fresh rows. 'max' = expire immediately.
  revalidateTag("catalog-data", "max");
}

/**
 * On-demand purge of the public invoice pages. Called after any write
 * that changes what an invoice page shows: issue (404 → live page),
 * payment (amount_paid / balance_due / status from the ledger),
 * void (old link becomes the "replaced" notice), and company profile
 * edits (address / phone / email / logo render live, not snapshot).
 */
export async function revalidateInvoices() {
  revalidatePath("/invoice/[token]", "page");
}
