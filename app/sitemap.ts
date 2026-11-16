import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

// Public pages only. Product entries come from the live catalog; if the
// site URL is not configured, an empty sitemap is better than a file with
// made-up absolute URLs.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return [];

  const url = (path: string) => new URL(path, base).toString();
  const now = new Date();

  const { data: products } = await supabase
    .from("products")
    .select("id, updated_at")
    .eq("is_active", true);

  return [
    { url: url("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: url("/catalog"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: url("/availability"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...(products ?? []).map((product) => ({
      url: url(`/product/${product.id}`),
      lastModified: product.updated_at ? new Date(product.updated_at) : now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
