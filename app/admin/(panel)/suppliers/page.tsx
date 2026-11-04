import { Suspense } from "react";
import SuppliersView from "@/components/admin/SuppliersView";
import { Breadcrumbs, PageHeader } from "@/components/admin/ui";
import { ListRowsSkeleton } from "@/components/admin/skeletons";

export default function SuppliersListPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Supplier" }]}
        />
      </div>
      <PageHeader
        title="Supplier"
        subtitle="Tempat membeli barang dan bahan — terpisah dari vendor acara"
      />

      <Suspense fallback={<ListRowsSkeleton rows={4} />}>
        <SuppliersView />
      </Suspense>
    </div>
  );
}
