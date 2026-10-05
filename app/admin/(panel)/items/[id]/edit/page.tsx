import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import ItemForm from "@/components/admin/ItemForm";

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
  const itemCategories = [
    ...new Set(rows.map((r) => r.item_category)),
  ].sort();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Ubah Item</h1>
        <p className="mt-1 text-sm text-gray-500">{item.name}</p>
      </div>

      <ItemForm item={item} itemCategories={itemCategories} />
    </div>
  );
}
