import DelayedFallback from "@/components/admin/DelayedFallback";
import { Card, Skeleton } from "@/components/admin/ui";

function TableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat halaman">
      <Skeleton className="mb-4 h-4 w-40" />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full rounded-lg sm:w-64" />
        <Skeleton className="h-10 w-full rounded-lg sm:w-40" />
        <Skeleton className="h-10 w-full rounded-lg sm:w-36" />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-4 p-4">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="hidden h-4 w-16 md:block" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function AdminPanelLoading() {
  return <DelayedFallback fallback={<TableSkeleton />} delay={600} />;
}
