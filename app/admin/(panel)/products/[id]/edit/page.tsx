import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Category } from "@/lib/types";
import ProductForm from "@/components/admin/ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("id", params.id)
      .single(),
    supabase.from("categories").select("*").order("name"),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Ubah Produk</h1>
        <p className="mt-1 text-sm text-gray-500">{product.name}</p>
      </div>

      <ProductForm
        categories={(categories ?? []) as Category[]}
        product={product}
      />
    </div>
  );
}
