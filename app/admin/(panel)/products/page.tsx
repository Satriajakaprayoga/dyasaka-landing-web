import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import type { Category, Product, ProductImage } from "@/lib/types";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  btnPrimary,
} from "@/components/admin/ui";
import { PackageIcon, PlusIcon } from "@/components/admin/icons";

export default async function ProductsListPage() {
  const supabase = createServerSupabase();

  const { data: products } = await supabase
    .from("products")
    .select("*, categories(name), product_images(image_url, sort_order)")
    .order("created_at", { ascending: false })
    .returns<
      (Product & {
        categories: Pick<Category, "name">;
        product_images: Pick<ProductImage, "image_url" | "sort_order">[];
      })[]
    >();

  const rows = products ?? [];

  return (
    <div>
      <PageHeader title="Produk" subtitle="Kelola katalog dekorasi">
        <Link href="/admin/products/new" className={btnPrimary}>
          <PlusIcon className="h-4 w-4" />
          Tambah Produk
        </Link>
      </PageHeader>

      <Card className="overflow-hidden">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Produk</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Harga</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((p) => {
                  const cover = [...(p.product_images ?? [])].sort(
                    (a, b) => a.sort_order - b.sort_order,
                  )[0];
                  return (
                    <tr key={p.id} className="transition hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {cover ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={cover.image_url}
                              alt={p.name}
                              className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                            />
                          ) : (
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                              <PackageIcon className="h-4 w-4" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">
                              {p.name}
                            </p>
                            {p.description && (
                              <p className="max-w-xs truncate text-xs text-gray-400">
                                {p.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {p.categories?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-gray-900">
                        Rp {p.price.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={p.is_active ? "green" : "gray"}>
                          {p.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada produk"
            subtitle="Tambahkan produk pertama untuk melengkapi katalog."
          >
            <Link href="/admin/products/new" className={btnPrimary}>
              <PlusIcon className="h-4 w-4" />
              Tambah Produk
            </Link>
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
