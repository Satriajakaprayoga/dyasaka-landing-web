import { Suspense } from "react";
import VendorsView from "@/components/admin/VendorsView";
import { Breadcrumbs, PageHeader } from "@/components/admin/ui";
import { ListRowsSkeleton } from "@/components/admin/skeletons";

export default function VendorsListPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Vendor" }]}
        />
      </div>
      <PageHeader
        title="Vendor"
        subtitle="Mitra eksternal — jasa (fotografer, badut) dan properti sewa"
      />

      <Suspense fallback={<ListRowsSkeleton rows={4} />}>
        <VendorsView />
      </Suspense>
    </div>
  );
}
