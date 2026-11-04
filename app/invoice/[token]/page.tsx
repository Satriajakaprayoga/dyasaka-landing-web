import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { CompanyProfile, Invoice, InvoiceItem, InvoiceStatus } from "@/lib/types";
import {
  InvoiceStatusBadge,
  btnPrimary,
  formatDate,
  formatRupiah,
} from "@/components/admin/ui";
import PrintButton from "./PrintButton";

// On-demand static (ISR): the page renders identically for every
// visitor — the token IS the capability — so it caches per token with
// no TTL. The data path needs no login: get_invoice_by_token is a
// security-definer RPC (anon EXECUTE) and company_profile is anon-
// readable, so the plain anon client works and cookies() never runs.
// Stale copies are purged by revalidateInvoices() (lib/revalidate-
// public.ts) from the invoice mutations (issue / record-payment /
// void) and ledger writes carrying invoice_id — so a cached invoice
// never keeps saying "unpaid" after a payment lands.
export async function generateStaticParams() {
  // Intentionally empty: every token renders on first request and is
  // then cached. Prerendering at build adds nothing — invoices are
  // issued at runtime, so new tokens never exist at build time.
  return [];
}

export const metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

// The RPC answers three ways (20261101100000_invoice_multi.sql):
//   issued/paid → the full invoice; amount_paid/balance_due computed
//     from ledger `in` rows, bill-to fields prefer issue snapshots.
//   void        → slim "replaced" payload, no amounts, plus the
//     current (non-void) invoice's token when one exists.
//   draft/unknown → null (renders the same 404 as any bad link).
type InvoiceRpc =
  | {
      replaced: false;
      invoice: Omit<Invoice, "access_token"> & {
        amount_paid: number;
        balance_due: number;
      };
      items: InvoiceItem[];
      booking: {
        customer_name: string;
        phone: string;
        event_date: string;
        event_address: string;
        theme: string | null;
      };
    }
  | {
      replaced: true;
      invoice_number: string | null;
      current_token: string | null;
    };

export default async function PublicInvoicePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  // Public read path: ONLY the security-definer RPC — anon has no
  // select on invoices. Unknown/draft/void tokens all return null →
  // the same plain 404, revealing nothing.
  const [rpcRes, profileRes] = await Promise.all([
    supabase.rpc("get_invoice_by_token", { p_token: token }),
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

  // A voided invoice's old link must never 404 (customers bookmark and
  // print these) — it points to the replacement instead. No amounts,
  // so a stale printed total can't be confused with a live one.
  if (data.replaced) {
    return (
      <main className="min-h-screen bg-gray-100 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-gray-900">
              Invoice telah digantikan
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {data.invoice_number
                ? `Invoice ${data.invoice_number} sudah dibatalkan dan digantikan oleh invoice yang lebih baru.`
                : "Invoice ini sudah dibatalkan dan digantikan oleh invoice yang lebih baru."}
            </p>
            {data.current_token && (
              <a
                href={`/invoice/${data.current_token}`}
                className={btnPrimary + " mt-6 inline-block"}
              >
                Lihat Invoice Terbaru
              </a>
            )}
          </div>
        </div>
      </main>
    );
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
                {invoice.invoice_type === "dp" ? "Invoice DP" : "Invoice"}
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
