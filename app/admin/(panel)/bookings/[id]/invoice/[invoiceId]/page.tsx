import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type {
  Booking,
  CompanyBankAccount,
  Invoice,
  InvoiceItem,
} from "@/lib/types";
import InvoiceManager from "@/components/admin/InvoiceManager";
import { BackLink, Breadcrumbs, InvoiceStatusBadge } from "@/components/admin/ui";

type BookingRef = Pick<
  Booking,
  "id" | "customer_name" | "phone" | "status" | "event_date"
>;

export default async function InvoiceManagerPage({
  params,
}: {
  params: { id: string; invoiceId: string };
}) {
  const supabase = createServerSupabase();

  const [bookingRes, invoiceRes, itemsRes, banksRes, profileRes] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id, customer_name, phone, status, event_date")
        .eq("id", params.id)
        .maybeSingle(),
      supabase.from("invoices").select("*").eq("id", params.invoiceId).single(),
      supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", params.invoiceId)
        .order("sort_order"),
      supabase
        .from("company_bank_accounts")
        .select("*")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("company_profile")
        .select("company_name, logo_url")
        .limit(1)
        .maybeSingle(),
    ]);

  const booking = (bookingRes.data ?? null) as BookingRef | null;
  const invoice = (invoiceRes.data ?? null) as Invoice | null;

  // The invoice URL must belong to the booking URL — anything else is 404.
  if (!booking || !invoice || invoice.booking_id !== booking.id) {
    notFound();
  }

  const items = (itemsRes.data ?? []) as InvoiceItem[];
  const banks = (banksRes.data ?? []) as CompanyBankAccount[];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Booking", href: "/admin/bookings" },
            { label: booking.customer_name, href: `/admin/bookings/${booking.id}` },
            { label: "Invoice" },
          ]}
        />
        <BackLink href={`/admin/bookings/${booking.id}`} />
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">
          {invoice.invoice_number ?? "Draft Invoice"}
        </h1>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <InvoiceManager
        booking={booking}
        invoice={invoice}
        initialItems={items}
        bankAccounts={banks}
        companyName={profileRes.data?.company_name ?? null}
        logoUrl={profileRes.data?.logo_url ?? null}
      />
    </div>
  );
}
