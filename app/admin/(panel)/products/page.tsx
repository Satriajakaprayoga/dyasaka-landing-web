import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import type { Category, Product, ProductImage } from "@/lib/types";
import ProductsTable from "@/components/admin/ProductsTable";
import { Breadcrumbs, PageHeader, btnPrimary } from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";
import { TableSkeleton } from "@/components/admin/skeletons";

export default function ProductsListPage() {
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

      <Suspense fallback={<TableSkeleton />}>
        <ProductsList />
      </Suspense>
    </div>
  );
}

async function ProductsList() {
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

  return <ProductsTable rows={products ?? []} />;
}
