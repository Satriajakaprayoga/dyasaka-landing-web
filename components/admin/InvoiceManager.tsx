"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWhatsAppLink, normalizePhoneToWa } from "@/lib/booking-helpers";
import type {
  Booking,
  CompanyBankAccount,
  Invoice,
  InvoiceItem,
  InvoiceLineSource,
  Product,
  Vendor,
} from "@/lib/types";
import {
  Card,
  formatDate,
  formatRupiah,
  inputClass,
  labelClass,
  btnPrimary,
  btnSecondary,
} from "./ui";
import { PlusIcon, TrashIcon } from "./icons";
import ConfirmModal from "./ConfirmModal";
import type { BookingCatalogItem } from "./BookingItemsPanel";

type BookingRef = Pick<Booking, "id" | "customer_name" | "phone" | "event_date">;

// Active product tagged with a vendor — feeds the picker's Vendor group.
export type VendorProductRef = Pick<
  Product,
  "id" | "name" | "price" | "vendor_id"
> & { vendors: Pick<Vendor, "name"> };

function variantTitle(
  itemName: string | undefined,
  color: string | null | undefined,
  size: string | null | undefined,
) {
  const details = [color, size].filter(Boolean).join(", ");
  return details ? `${itemName} (${details})` : (itemName ?? "Varian");
}

type EditableLine = {
  description: string;
  quantity: string;
  unit_price: string;
  source_type: InvoiceLineSource;
};

function toEditableLines(items: InvoiceItem[]): EditableLine[] {
  return items.map((i) => ({
    description: i.description,
    quantity: String(i.quantity),
    unit_price: String(i.unit_price),
    source_type: i.source_type,
  }));
}

type Props = {
  booking: BookingRef;
  invoice: Invoice;
  initialItems: InvoiceItem[];
  bankAccounts: CompanyBankAccount[];
  catalog: BookingCatalogItem[];
  vendorProducts: VendorProductRef[];
  companyName: string | null;
  logoUrl: string | null;
  /** Ledger-derived: Σ `in` transactions carrying this invoice. */
  initialPaid: number;
  /** Ledger-derived: Σ `in` transactions for the whole booking (DP etc). */
  bookingPaid: number;
};

export default function InvoiceManager({
  booking,
  invoice: initialInvoice,
  initialItems,
  bankAccounts,
  catalog,
  vendorProducts,
  companyName,
  logoUrl,
  initialPaid,
  bookingPaid,
}: Props) {
  const router = useRouter();

  const [invoice, setInvoice] = useState(initialInvoice);
  const [items, setItems] = useState(initialItems);
  // Paid/balance are calculated from the ledger — never stored on the
  // invoice — so the manager carries them as plain state.
  const [paid, setPaid] = useState(initialPaid);

  const [lines, setLines] = useState<EditableLine[]>(() =>
    toEditableLines(initialItems),
  );
  const [dueDate, setDueDate] = useState(initialInvoice.due_date ?? "");
  const [notes, setNotes] = useState(initialInvoice.notes ?? "");
  const [bankId, setBankId] = useState(initialInvoice.bank_account_id ?? "");

  const balance = Math.max(Number(invoice.total) - paid, 0);

  const [paymentAmount, setPaymentAmount] = useState(() =>
    initialInvoice.status === "issued" && balance > 0 ? String(balance) : "",
  );
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );

  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const isDraft = invoice.status === "draft";
  const isIssued = invoice.status === "issued";
  const isVoid = invoice.status === "void";

  const publicLink = `${origin}/invoice/${invoice.access_token}`;

  const parsedLines = useMemo(
    () =>
      lines.map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        source_type: l.source_type,
      })),
    [lines],
  );

  const hasLineIssues = parsedLines.some(
    (l) =>
      !l.description ||
      l.description.length > 200 ||
      !Number.isInteger(l.quantity) ||
      l.quantity <= 0 ||
      !Number.isFinite(l.unit_price) ||
      l.unit_price < 0,
  );

  const subtotal = items.reduce((s, i) => s + Number(i.line_total), 0);

  function updateLine(index: number, key: keyof EditableLine, value: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        description: "",
        quantity: "1",
        unit_price: "0",
        source_type: "custom" as const,
      },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  // ---------- Catalog picker (same grouping as BookingItemsPanel) ----------

  const [pickerId, setPickerId] = useState("");

  const variantById = useMemo(
    () =>
      new Map(
        catalog.flatMap((item) =>
          item.item_variants.map((v) => [v.id, { item, variant: v }]),
        ),
      ),
    [catalog],
  );

  const pickerGroups = useMemo(() => {
    const groups = new Map<string, { id: string; label: string }[]>();
    for (const item of catalog) {
      for (const v of item.item_variants) {
        const list = groups.get(item.item_category) ?? [];
        list.push({
          id: v.id,
          label: `${variantTitle(item.name, v.color, v.size)} — ${formatRupiah(v.current_price)}`,
        });
        groups.set(item.item_category, list);
      }
    }
    return [...groups.entries()];
  }, [catalog]);

  const vendorProductById = useMemo(
    () => new Map(vendorProducts.map((p) => [p.id, p])),
    [vendorProducts],
  );

  const pickerVendorGroups = useMemo(() => {
    const groups = new Map<string, { id: string; label: string }[]>();
    for (const p of vendorProducts) {
      const vendorName = p.vendors?.name ?? "Vendor";
      const list = groups.get(vendorName) ?? [];
      list.push({
        id: p.id,
        label: `${p.name} — ${formatRupiah(Number(p.price))}`,
      });
      groups.set(vendorName, list);
    }
    return [...groups.entries()];
  }, [vendorProducts]);

  function addFromPicker(id: string) {
    setPickerId("");
    // Vendor products come in at their selling price — admin adjusts.
    const vendorProduct = vendorProductById.get(id);
    if (vendorProduct) {
      setLines((prev) => [
        ...prev,
        {
          description: vendorProduct.name,
          quantity: "1",
          unit_price: String(vendorProduct.price),
          source_type: "vendor" as const,
        },
      ]);
      return;
    }
    const found = variantById.get(id);
    if (!found) return;
    setLines((prev) => [
      ...prev,
      {
        description: variantTitle(
          found.item.name,
          found.variant.color,
          found.variant.size,
        ),
        quantity: "1",
        unit_price: String(found.variant.current_price),
        source_type: "item" as const,
      },
    ]);
  }

  async function patchAction(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<{
    invoice?: Invoice;
    items?: InvoiceItem[];
    paid?: number;
    balance_due?: number;
  } | null> {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoice.id, action, ...payload }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Gagal menyimpan");
        return null;
      }

      const body = await res.json();
      if (body.invoice) setInvoice(body.invoice);
      if (typeof body.paid === "number") setPaid(body.paid);
      if (body.items) {
        setItems(body.items);
        setLines(toEditableLines(body.items));
      }
      router.refresh();
      return body;
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveLines() {
    await patchAction("save-lines", {
      lines: parsedLines,
      due_date: dueDate || null,
      notes: notes || null,
      bank_account_id: bankId || null,
    });
  }

  async function issue() {
    if (
      !confirm(
        "Terbitkan invoice? Nomor akan ditetapkan dan SEMUA baris serta total menjadi permanen (tidak bisa diedit). Untuk koreksi setelah terbit, invoice harus dibatalkan dan diterbitkan ulang.",
      )
    )
      return;
    // Persist the current edits first — issuing locks what's stored,
    // not what's still sitting in the form.
    const saved = await patchAction("save-lines", {
      lines: parsedLines,
      due_date: dueDate || null,
      notes: notes || null,
      bank_account_id: bankId || null,
    });
    if (saved) await patchAction("issue", {});
  }

  async function recordPayment() {
    const body = await patchAction("record-payment", {
      amount: Number(paymentAmount),
      transaction_date: paymentDate,
    });
    if (body?.invoice) setPaymentAmount("");
  }

  async function voidInvoice() {
    setConfirmVoid(false);
    await patchAction("void", {});
  }

  async function deleteDraft() {
    setConfirmDelete(false);
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/invoices?id=${invoice.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Gagal menghapus draft");
        return;
      }
      router.push(`/admin/bookings/${booking.id}`);
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Gagal menyalin tautan");
    }
  }

  // Final draft: show what the customer already paid across the booking
  // (deposit included) and what remains after this invoice.
  const remainingAfterThis =
    invoice.invoice_type === "final"
      ? Math.max(Number(invoice.total) - bookingPaid, 0)
      : null;

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Document header — mirrors what the customer sees */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={companyName ?? "Logo"}
                className="h-10 w-10 rounded-lg border border-gray-200 object-contain"
              />
            ) : null}
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {invoice.company_name_snapshot ?? companyName ?? "—"}
              </p>
              <p className="text-xs text-gray-500">
                {invoice.invoice_type === "dp" ? "Invoice DP" : "Invoice Final"}{" "}
                · Untuk: {invoice.customer_name_snapshot ?? booking.customer_name}{" "}
                · Acara{" "}
                {formatDate(invoice.event_date_snapshot ?? booking.event_date)}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            {invoice.invoice_number && (
              <p className="font-medium text-gray-900">
                {invoice.invoice_number}
              </p>
            )}
            {invoice.issue_date && <p>Terbit {formatDate(invoice.issue_date)}</p>}
            {invoice.due_date && <p>Jatuh tempo {formatDate(invoice.due_date)}</p>}
          </div>
        </div>
      </Card>

      {isDraft && (
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Baris Invoice
          </h2>

          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Deskripsi"
                  value={line.description}
                  onChange={(e) => updateLine(i, "description", e.target.value)}
                  className={inputClass + " min-w-40 flex-1"}
                />
                <input
                  type="number"
                  min={1}
                  step={1}
                  aria-label="Jumlah"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, "quantity", e.target.value)}
                  className={inputClass + " w-20"}
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  aria-label="Harga satuan"
                  value={line.unit_price}
                  onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                  className={inputClass + " w-36"}
                />
                <span className="w-32 text-right text-sm tabular-nums text-gray-700">
                  {formatRupiah(
                    (Number(line.quantity) || 0) * (Number(line.unit_price) || 0),
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`Hapus baris ${i + 1}`}
                  onClick={() => removeLine(i)}
                  disabled={busy}
                  className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 hover:text-red-600"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            {lines.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-400">
                Belum ada baris — tambahkan minimal satu baris.
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addLine}
              disabled={busy}
              className={btnSecondary}
            >
              <PlusIcon className="h-4 w-4" />
              Tambah Baris
            </button>
            <select
              aria-label="Tambah dari katalog"
              value={pickerId}
              onChange={(e) => addFromPicker(e.target.value)}
              disabled={busy}
              className={inputClass + " w-72"}
            >
              <option value="">Tambah dari Katalog…</option>
              {pickerGroups.map(([category, variants]) => (
                <optgroup key={category} label={category}>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              {pickerVendorGroups.map(([vendorName, products]) => (
                <optgroup key={vendorName} label={vendorName}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="mt-5 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3">
            <div>
              <label htmlFor="due_date" className={labelClass}>
                Jatuh Tempo
              </label>
              <input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="bank_account" className={labelClass}>
                Rekening Bank
              </label>
              <select
                id="bank_account"
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className={inputClass}
              >
                <option value="">— Pilih rekening —</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} • {b.account_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="notes" className={labelClass}>
                Catatan
              </label>
              <textarea
                id="notes"
                rows={1}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
            <div className="text-sm text-gray-600">
              Total:{" "}
              <span className="text-base font-semibold text-gray-900">
                {formatRupiah(subtotal)}
              </span>
              {remainingAfterThis != null && (
                <span className="mt-0.5 block text-xs">
                  Sudah diterima dari pelanggan (termasuk DP):{" "}
                  {formatRupiah(bookingPaid)} · Sisa setelah invoice ini{" "}
                  <span className="font-semibold text-gray-900">
                    {formatRupiah(remainingAfterThis)}
                  </span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hapus Draft
              </button>
              <button
                type="button"
                onClick={saveLines}
                disabled={busy || hasLineIssues}
                className={btnSecondary}
              >
                {busy ? "…" : "Simpan Draft"}
              </button>
              <button
                type="button"
                onClick={issue}
                disabled={
                  busy || hasLineIssues || lines.length === 0 || !bankId
                }
                title={
                  lines.length === 0
                    ? "Tambahkan minimal satu baris"
                    : !bankId
                      ? "Pilih rekening bank"
                      : undefined
                }
                className={btnPrimary}
              >
                Terbitkan
              </button>
            </div>
          </div>
        </Card>
      )}

      {!isDraft && (
        <>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2.5 font-medium">Deskripsi</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Harga
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Jumlah
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5 text-gray-900">
                      {item.description}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                      {formatRupiah(Number(item.unit_price))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">
                      {formatRupiah(Number(item.line_total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1.5 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm">
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
                <span className="tabular-nums">{formatRupiah(paid)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-gray-900">
                <span>Sisa Tagihan</span>
                <span className="tabular-nums">{formatRupiah(balance)}</span>
              </div>
            </div>
            {isIssued && (
              <p className="border-t border-gray-200 px-4 py-3 text-xs text-gray-400">
                Invoice terbit bersifat permanen — baris dan total tidak bisa
                diedit. Koreksi: batalkan (void), lalu terbitkan ulang dari
                halaman booking.
              </p>
            )}
          </Card>

          {isIssued && (
            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-gray-900">
                Pembayaran &amp; Pengiriman
              </h2>

              {balance > 0 ? (
                <div className="mb-4 flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor="payment" className={labelClass}>
                      Nominal Pembayaran
                    </label>
                    <input
                      id="payment"
                      type="number"
                      min={0.01}
                      max={balance}
                      step={0.01}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className={inputClass + " w-48"}
                    />
                  </div>
                  <div>
                    <label htmlFor="payment_date" className={labelClass}>
                      Tanggal
                    </label>
                    <input
                      id="payment_date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className={inputClass + " w-40"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={recordPayment}
                    disabled={
                      busy ||
                      !(Number(paymentAmount) > 0) ||
                      Number(paymentAmount) > balance
                    }
                    className={btnPrimary}
                  >
                    Catat Pembayaran
                  </button>
                </div>
              ) : (
                <p className="mb-4 text-sm text-green-600">
                  Invoice sudah lunas.
                </p>
              )}
              <p className="mb-4 -mt-2 text-xs text-gray-400">
                Pembayaran tercatat sebagai transaksi masuk di Buku Kas —
                dibayar dan sisa dihitung dari sana.
              </p>

              <div className="mb-1 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={publicLink}
                  onFocus={(e) => e.target.select()}
                  className={inputClass + " min-w-60 flex-1 bg-gray-50"}
                />
                <button type="button" onClick={copyLink} className={btnSecondary}>
                  {copied ? "Tersalin" : "Copy"}
                </button>
                <a
                  href={buildWhatsAppLink(
                    normalizePhoneToWa(booking.phone),
                    `Halo ${booking.customer_name}, berikut invoice acara Anda: ${publicLink}`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={btnPrimary}
                >
                  Kirim via WhatsApp
                </a>
              </div>

              <button
                type="button"
                onClick={() => setConfirmVoid(true)}
                disabled={busy}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Batalkan Invoice
              </button>
            </Card>
          )}

          {isVoid && (
            <Card className="p-5">
              <p className="text-sm text-gray-600">
                Invoice ini dibatalkan. Tautan lama pelanggan menampilkan
                pemberitahuan pengganti. Terbitkan invoice pengganti dari
                halaman booking — pembayaran yang salah bisa dibalikkan di
                Buku Kas.
              </p>
              <button
                type="button"
                onClick={() => router.push(`/admin/bookings/${booking.id}`)}
                className={btnSecondary + " mt-3"}
              >
                Ke Halaman Booking
              </button>
            </Card>
          )}
        </>
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Hapus draft invoice ini?"
        description="Draft yang dihapus tidak bisa dikembalikan. Booking tetap aman."
        busy={busy}
        onConfirm={deleteDraft}
        onClose={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={confirmVoid}
        title="Batalkan invoice ini?"
        description="Tautan pelanggan hanya menampilkan pemberitahuan pengganti. Nomor tidak dipakai ulang."
        confirmLabel="Batalkan Invoice"
        busy={busy}
        onConfirm={voidInvoice}
        onClose={() => setConfirmVoid(false)}
      >
        <p className="text-gray-600">
          Invoice pengganti diterbitkan dari halaman booking setelah ini.
          {paid > 0 &&
            ` Pembayaran ${formatRupiah(paid)} yang sudah tercatat tetap ada di Buku Kas — balikkan di sana bila salah.`}
        </p>
      </ConfirmModal>
    </div>
  );
}
