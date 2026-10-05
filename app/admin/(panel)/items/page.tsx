import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import type { Item, ItemVariant } from "@/lib/types";
import ItemsTable from "@/components/admin/ItemsTable";
import { PageHeader, btnPrimary } from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";

export default async function ItemsListPage() {
  const supabase = createServerSupabase();

  const { data: items } = await supabase
    .from("items")
    .select("*, item_variants(*)")
    .order("name")
    .returns<(Item & { item_variants: ItemVariant[] })[]>();

  return (
    <div>
      <PageHeader
        title="Inventori"
        subtitle="Item & varian penyusun paket dekorasi"
      >
        <Link href="/admin/items/new" className={btnPrimary}>
          <PlusIcon className="h-4 w-4" />
          Tambah Item
        </Link>
      </PageHeader>

      <ItemsTable rows={items ?? []} />
    </div>
  );
}
