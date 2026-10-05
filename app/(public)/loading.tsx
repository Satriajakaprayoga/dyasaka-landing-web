import { Skeleton } from "@/components/admin/ui";

export default function PublicLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Memuat halaman"
      className="mx-auto max-w-6xl px-4 py-8"
    >
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-6 h-4 w-72" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
