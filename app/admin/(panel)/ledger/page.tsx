import { Suspense } from "react";
import LedgerView from "@/components/admin/LedgerView";
import { Breadcrumbs, PageHeader } from "@/components/admin/ui";
import { ListRowsSkeleton } from "@/components/admin/skeletons";

export default function LedgerPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Kas" }]}
        />
      </div>
      <PageHeader
        title="Buku Kas"
        subtitle="Semua uang masuk dan keluar. Salah catat? Balikkan — jangan dihapus."
      />

      <Suspense fallback={<ListRowsSkeleton rows={5} />}>
        <LedgerView />
      </Suspense>
    </div>
  );
}
