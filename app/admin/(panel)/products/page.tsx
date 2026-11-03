import { Suspense } from "react";
import Link from "next/link";
import ProductsView from "@/components/admin/ProductsView";
import { Breadcrumbs, PageHeader, btnPrimary } from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";
import { ProductTableRowsSkeleton } from "@/components/admin/skeletons";

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

      {/* ProductsView uses useSearchParams (filter persistence) and loads
          data client-side, so it needs a Suspense boundary. */}
      <Suspense fallback={<ProductTableRowsSkeleton rows={8} />}>
        <ProductsView />
      </Suspense>
    </div>
  );
}
