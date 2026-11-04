import { Suspense } from "react";
import StaffView from "@/components/admin/StaffView";
import { Breadcrumbs, PageHeader } from "@/components/admin/ui";
import { ListRowsSkeleton } from "@/components/admin/skeletons";

export default function StaffListPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Staff" }]}
        />
      </div>
      <PageHeader
        title="Staff"
        subtitle="Orang yang dibayar — staff tetap dan helper acara"
      />

      <Suspense fallback={<ListRowsSkeleton rows={4} />}>
        <StaffView />
      </Suspense>
    </div>
  );
}
