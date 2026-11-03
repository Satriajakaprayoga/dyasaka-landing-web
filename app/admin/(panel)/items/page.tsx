import { Suspense } from "react";
import Link from "next/link";
import ItemsView from "@/components/admin/ItemsView";
import { Breadcrumbs, PageHeader, btnPrimary } from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";
import { ProductTableRowsSkeleton } from "@/components/admin/skeletons";

export default function ItemsListPage() {
  return (
    <div>
      <div className="mb-4">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Inventori" },
          ]}
        />
      </div>
      <PageHeader
        title="Inventori"
        subtitle="Item & varian penyusun paket dekorasi"
      >
        <Link href="/admin/items/new" className={btnPrimary}>
          <PlusIcon className="h-4 w-4" />
          Tambah Item
        </Link>
      </PageHeader>

      <Suspense fallback={<ProductTableRowsSkeleton rows={8} />}>
        <ItemsView />
      </Suspense>
    </div>
  );
}
