import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import type { CompanyProfile, Invoice, InvoiceItem, InvoiceStatus } from "@/lib/types";
import {
  InvoiceStatusBadge,
  formatDate,
  formatRupiah,
} from "@/components/admin/ui";
import PrintButton from "./PrintButton";

// force-dynamic switches fetch in this route to no-store — a customer must
// always see the invoice's current totals, never a Data-Cache snapshot from
// before an admin correction.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

type InvoiceRpc = {
  invoice: Omit<Invoice, "access_token">;
  items: InvoiceItem[];
  booking: {
    customer_name: string;
    phone: string;
    event_date: string;
    event_address: string;
    theme: string | null;
  };
};

export default async function PublicInvoicePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createServerSupabase();

  // Public read path: ONLY the security-definer RPC — anon has no
  // select on invoices. Unknown/draft/void tokens all return null →
  // the same plain 404, revealing nothing.
  const [rpcRes, profileRes] = await Promise.all([
    supabase.rpc("get_invoice_by_token", { p_token: params.token }),
    supabase
      .from("company_profile")
      .select("company_name, logo_url, address, phone, email")
      .limit(1)
      .maybeSingle(),
  ]);

  const data = (rpcRes.data ?? null) as InvoiceRpc | null;
  if (!data) {
    notFound();
  }

  const { invoice, items, booking } = data;
  const profile = (profileRes.data ?? null) as Pick<
    CompanyProfile,
    "company_name" | "logo_url" | "address" | "phone" | "email"
  > | null;

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
          {/* Company header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {profile?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.logo_url}
                  alt="Logo"
                  className="h-12 w-12 rounded-lg border border-gray-200 object-contain"
                />
              )}
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {invoice.company_name_snapshot ?? profile?.company_name ?? "—"}
                </p>
                {profile?.address && (
                  <p className="whitespace-pre-line text-xs text-gray-500">
                    {profile.address}
                  </p>
                )}
                {(profile?.phone || profile?.email) && (
                  <p className="text-xs text-gray-500">
                    {[profile?.phone, profile?.email].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Invoice
              </p>
              {invoice.invoice_number && (
                <p className="text-sm font-medium text-gray-900">
                  {invoice.invoice_number}
                </p>
              )}
            </div>
          </div>

          <hr className="my-6 border-gray-200" />

          {/* Meta + bill-to */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Diterbitkan
              </p>
              <p className="mt-0.5 text-gray-900">
                {invoice.issue_date ? formatDate(invoice.issue_date) : "—"}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-400">
                Jatuh Tempo
              </p>
              <p className="mt-0.5 text-gray-900">
                {invoice.due_date ? formatDate(invoice.due_date) : "—"}
              </p>
              <p className="mt-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                Status
              </p>
              <p className="mt-1">
                <InvoiceStatusBadge status={invoice.status as InvoiceStatus} />
              </p>
            </div>
            <div className="text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Ditagihkan Kepada
              </p>
              <p className="mt-0.5 font-medium text-gray-900">
                {booking.customer_name}
              </p>
              <p className="text-gray-600">{booking.phone}</p>
              <p className="whitespace-pre-line text-gray-600">
                {booking.event_address}
              </p>
              {booking.theme && (
                <p className="mt-1 text-gray-500">Tema: {booking.theme}</p>
              )}
              <p className="mt-1 text-gray-500">
                Acara {formatDate(booking.event_date)}
              </p>
            </div>
          </div>

          {/* Lines */}
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-2 font-medium">Deskripsi</th>
                <th className="py-2 px-2 text-right font-medium">Qty</th>
                <th className="py-2 pl-2 text-right font-medium">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-2 text-gray-900">
                    {item.description}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums text-gray-600">
                    {item.quantity}
                  </td>
                  <td className="py-2.5 pl-2 text-right tabular-nums text-gray-900">
                    {formatRupiah(Number(item.line_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatRupiah(Number(invoice.subtotal))}
              </span>
            </div>
            <div className="flex justify-between font-medium text-gray-900">
              <span>Total</span>
              <span className="tabular-nums">
                {formatRupiah(Number(invoice.total))}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Dibayar</span>
              <span className="tabular-nums">
                {formatRupiah(Number(invoice.amount_paid))}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base font-semibold text-gray-900">
              <span>Sisa Tagihan</span>
              <span className="tabular-nums">
                {formatRupiah(Number(invoice.balance_due))}
              </span>
            </div>
          </div>

          {/* Payment destination */}
          {invoice.bank_account_snapshot && (
            <div className="mt-8 rounded-lg bg-gray-50 p-4 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Pembayaran ke
              </p>
              <p className="mt-1 font-medium text-gray-900">
                {invoice.bank_account_snapshot}
              </p>
            </div>
          )}

          {invoice.notes && (
            <div className="mt-4 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Catatan
              </p>
              <p className="mt-1 whitespace-pre-line text-gray-600">
                {invoice.notes}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-center print:hidden">
          <PrintButton />
        </div>
      </div>
    </main>
  );
}
