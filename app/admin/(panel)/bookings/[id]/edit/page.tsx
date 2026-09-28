import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { Product } from "@/lib/types";
import BookingForm from "@/components/admin/BookingForm";

export default async function EditBookingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerSupabase();

  const [{ data: booking }, { data: products }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .eq("id", params.id)
      .single(),
    supabase.from("products").select("*").order("name"),
  ]);

  if (!booking) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Ubah Booking</h1>
        <p className="mt-1 text-sm text-gray-500">
          {booking.customer_name} · {booking.event_date}
        </p>
      </div>

      <BookingForm booking={booking} products={(products ?? []) as Product[]} />
    </div>
  );
}
