import { Card, Skeleton } from "./ui";

// Table-area fallback: toolbar + rows (shell above it is already rendered).
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full rounded-lg sm:w-64" />
        <Skeleton className="h-10 w-full rounded-lg sm:w-40" />
        <Skeleton className="h-10 w-full rounded-lg sm:w-36" />
      </div>
      <Card className="overflow-hidden">
        <div className="space-y-4 p-4">
          {Array.from({ length: rows }).map((_, i) => (
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

export function StatsGridSkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="mt-4 h-7 w-12" />
          <Skeleton className="mt-2 h-4 w-24" />
        </Card>
      ))}
    </div>
  );
}

export function UpcomingBookingsSkeleton() {
  return (
    <Card>
      <div aria-busy="true" className="space-y-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function VariantsPanelSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <Card>
        <div className="space-y-4 p-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 border-b border-gray-100 pb-4 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
