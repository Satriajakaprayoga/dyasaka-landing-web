import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Admin, API, private invoice links and the offline shell are not
        // useful in search results.
        disallow: ["/admin", "/api", "/invoice", "/offline"],
      },
    ],
    ...(base ? { sitemap: new URL("/sitemap.xml", base).toString() } : {}),
  };
}
