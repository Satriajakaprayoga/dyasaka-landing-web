import { Suspense } from "react";
import CategoriesView from "@/components/admin/CategoriesView";
import { Breadcrumbs, PageHeader } from "@/components/admin/ui";
import { ListRowsSkeleton } from "@/components/admin/skeletons";

export default function CategoriesListPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Kategori" }]}
        />
      </div>
      <PageHeader
        title="Kategori"
        subtitle="Kelola kategori produk dan item inventori"
      />

      <Suspense fallback={<ListRowsSkeleton rows={4} />}>
        <CategoriesView />
      </Suspense>
    </div>
  );
}
