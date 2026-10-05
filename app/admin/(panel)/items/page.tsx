import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import type { Item, ItemVariant } from "@/lib/types";
import ItemsTable from "@/components/admin/ItemsTable";
import { Breadcrumbs, PageHeader, btnPrimary } from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";
import { TableSkeleton } from "@/components/admin/skeletons";

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

      <Suspense fallback={<TableSkeleton />}>
        <ItemsList />
      </Suspense>
    </div>
  );
}

async function ItemsList() {
  const supabase = createServerSupabase();

  const { data: items } = await supabase
    .from("items")
    .select("*, item_variants(*)")
    .order("name")
    .returns<(Item & { item_variants: ItemVariant[] })[]>();

  return <ItemsTable rows={items ?? []} />;
}
