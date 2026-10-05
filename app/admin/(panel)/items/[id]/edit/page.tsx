import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import ItemForm from "@/components/admin/ItemForm";
import { BackLink, Breadcrumbs } from "@/components/admin/ui";

export default async function EditItemPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();

  const [{ data: item }, { data: allItems }] = await Promise.all([
    supabase.from("items").select("*").eq("id", params.id).single(),
    supabase.from("items").select("item_category"),
  ]);

  if (!item) {
    notFound();
  }

  const rows = (allItems ?? []) as { item_category: string }[];
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.item_category, (counts.get(r.item_category) ?? 0) + 1);
  }
  const itemCategories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Inventori", href: "/admin/items" },
              { label: item.name, href: `/admin/items/${item.id}` },
              { label: "Ubah" },
            ]}
          />
          <BackLink href={`/admin/items/${item.id}`} />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Ubah Item</h1>
        <p className="mt-1 text-sm text-gray-500">{item.name}</p>
      </div>

      <ItemForm item={item} itemCategories={itemCategories} />
    </div>
  );
}
