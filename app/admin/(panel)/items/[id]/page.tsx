import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import type {
  ItemPriceHistory,
  ItemVariant,
  StockMovement,
} from "@/lib/types";
import VariantsPanel from "@/components/admin/VariantsPanel";
import { Badge } from "@/components/admin/ui";
import { PencilIcon } from "@/components/admin/icons";

export default async function ItemDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();

  const { data: item } = await supabase
    .from("items")
    .select("*, item_variants(*)")
    .eq("id", params.id)
    .single();

  if (!item) {
    notFound();
  }

  const variants = (item.item_variants ?? []) as ItemVariant[];
  const variantIds = variants.map((v) => v.id);

  const [movementsRes, pricesRes] = await Promise.all([
    variantIds.length
      ? supabase
          .from("stock_movements")
          .select("*")
          .in("item_variant_id", variantIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    variantIds.length
      ? supabase
          .from("item_price_history")
          .select("*")
          .in("item_variant_id", variantIds)
          .order("effective_from", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const movements = (movementsRes.data ?? []) as StockMovement[];
  const priceHistory = (pricesRes.data ?? []) as ItemPriceHistory[];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">
              {item.name}
            </h1>
            <Badge tone={item.type === "rentable" ? "amber" : "blue"}>
              {item.type === "rentable" ? "Sewa" : "Habis Pakai"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {item.item_category}
            {item.type === "rentable" && ` · Dimiliki: ${item.quantity_owned} unit`}
            {item.pieces_per_unit != null &&
              ` · ${item.pieces_per_unit} piece/unit`}
          </p>
        </div>
        <Link
          href={`/admin/items/${item.id}/edit`}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          <PencilIcon className="h-4 w-4" />
          Ubah Item
        </Link>
      </div>

      <VariantsPanel
        itemId={item.id}
        variants={variants}
        movements={movements}
        priceHistory={priceHistory}
      />
    </div>
  );
}
