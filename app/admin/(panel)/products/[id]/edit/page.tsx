import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Category, Vendor } from "@/lib/types";
import ProductForm from "@/components/admin/ProductForm";
import RecipePanel, {
  type RecipeCatalogItem,
  type RecipeRow,
} from "@/components/admin/RecipePanel";
import { BackLink, Breadcrumbs } from "@/components/admin/ui";

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();

  const [
    { data: product },
    { data: categories },
    { data: catalog },
    { data: vendors },
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        "*, product_images(*), product_items(id, product_id, item_variant_id, quantity, item_variants(color, size, current_price, items(name)))",
      )
      .eq("id", params.id)
      .single(),
    supabase.from("categories").select("*").order("name"),
    supabase
      .from("items")
      .select(
        "id, name, item_category, type, quantity_owned, item_variants(id, color, size, current_price)",
      )
      .order("name"),
    supabase.from("vendors").select("*").order("name"),
  ]);

  if (!product) {
    notFound();
  }

  // Child→parent embeds come back as objects, not arrays.
  const recipe = (product.product_items ?? []) as unknown as RecipeRow[];
  const catalogItems = (catalog ?? []) as unknown as RecipeCatalogItem[];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Produk", href: "/admin/products" },
              { label: product.name },
              { label: "Ubah" },
            ]}
          />
          <BackLink href="/admin/products" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Ubah Produk
        </h1>
        <p className="mt-1 text-sm text-gray-500">{product.name}</p>
      </div>

      <div className="space-y-8">
        <ProductForm
          categories={(categories ?? []) as Category[]}
          vendors={(vendors ?? []) as Vendor[]}
          product={product}
        />

        <RecipePanel
          productId={product.id}
          productItems={recipe}
          catalog={catalogItems}
        />
      </div>
    </div>
  );
}
