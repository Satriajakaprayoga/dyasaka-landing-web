import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import type { Category, Product, ProductImage } from "@/lib/types";
import ProductsTable from "@/components/admin/ProductsTable";
import { Breadcrumbs, PageHeader, btnPrimary } from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";

export default async function ProductsListPage() {
  const supabase = createServerSupabase();

  const { data: products } = await supabase
    .from("products")
    .select("*, categories(name), product_images(image_url, sort_order)")
    .order("created_at", { ascending: false })
    .returns<
      (Product & {
        categories: Pick<Category, "name">;
        product_images: Pick<ProductImage, "image_url" | "sort_order">[];
      })[]
    >();

  return (
    <div>
      <div className="mb-4">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Produk" }]}
        />
      </div>
      <PageHeader title="Produk" subtitle="Kelola katalog dekorasi">
        <Link href="/admin/products/new" className={btnPrimary}>
          <PlusIcon className="h-4 w-4" />
          Tambah Produk
        </Link>
      </PageHeader>

      <ProductsTable rows={products ?? []} />
    </div>
  );
}
