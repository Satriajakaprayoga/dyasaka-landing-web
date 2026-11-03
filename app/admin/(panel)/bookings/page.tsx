import { Suspense } from "react";
import Link from "next/link";
import BookingsView from "@/components/admin/BookingsView";
import { Breadcrumbs, PageHeader, btnPrimary } from "@/components/admin/ui";
import { PlusIcon } from "@/components/admin/icons";
import { ProductTableRowsSkeleton } from "@/components/admin/skeletons";

export default function BookingsListPage() {
  return (
    <div>
      <div className="mb-4">
        <Breadcrumbs
          items={[{ label: "Dashboard", href: "/admin" }, { label: "Booking" }]}
        />
      </div>
      <PageHeader title="Daftar Booking" subtitle="Kelola semua booking acara">
        <Link href="/admin/bookings/new" className={btnPrimary}>
          <PlusIcon className="h-4 w-4" />
          Tambah Booking
        </Link>
      </PageHeader>

      <Suspense fallback={<ProductTableRowsSkeleton rows={8} />}>
        <BookingsView />
      </Suspense>
    </div>
  );
}
