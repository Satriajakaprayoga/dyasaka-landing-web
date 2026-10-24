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
  companyName: string | null;
  logoUrl: string | null;
};

export default function InvoiceManager({
  booking,
  invoice: initialInvoice,
  initialItems,
  bankAccounts,
  catalog,
  companyName,
  logoUrl,
}: Props) {
  const router = useRouter();

  const [invoice, setInvoice] = useState(initialInvoice);
  const [items, setItems] = useState(initialItems);

  const [lines, setLines] = useState<EditableLine[]>(() =>
    toEditableLines(initialItems),
  );
  const [dueDate, setDueDate] = useState(initialInvoice.due_date ?? "");
  const [notes, setNotes] = useState(initialInvoice.notes ?? "");
  const [bankId, setBankId] = useState(initialInvoice.bank_account_id ?? "");

  const [paymentAmount, setPaymentAmount] = useState(() =>
    initialInvoice.status === "issued" ||
    initialInvoice.status === "partially_paid"
      ? String(initialInvoice.balance_due)
      : "",
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
  // Editable-until-paid: draft/issued/partially_paid share the line
  // editor; paid/void are strictly read-only.
  const isEditable =
    isDraft ||
    invoice.status === "issued" ||
    invoice.status === "partially_paid";
  const isPayable =
    invoice.status === "issued" || invoice.status === "partially_paid";

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

  const [pickerVariantId, setPickerVariantId] = useState("");

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

  function addFromCatalog(id: string) {
    setPickerVariantId("");
    const found = variantById.get(id);
    if (!found) return;
    // Vendor-owned items bill as vendor lines; house items as item lines.
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
        source_type: found.item.vendor_id ? "vendor" : "item",
      },
    ]);
  }

  async function patchAction(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<{ invoice?: Invoice; items?: InvoiceItem[] } | null> {
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
    const saved = await patchAction("save-lines", {
      lines: parsedLines,
      due_date: dueDate || null,
      notes: notes || null,
      bank_account_id: bankId || null,
    });
    // Edited totals change the balance — keep the payment input honest.
    if (saved?.invoice) setPaymentAmount(String(saved.invoice.balance_due));
  }

  async function issue() {
    if (
      !confirm(
        "Terbitkan invoice? Nomor invoice akan ditetapkan dan tautan pembayaran bisa dikirim ke pelanggan. Baris masih bisa dikoreksi setelah terbit.",
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
    });
    if (body?.invoice) setPaymentAmount(String(body.invoice.balance_due));
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
                Untuk: {booking.customer_name} · Acara{" "}
                {formatDate(booking.event_date)}
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

      {isEditable && (
        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            Baris Invoice
          </h2>
          {!isDraft && (
            <p className="-mt-2 mb-4 text-xs text-gray-400">
              Invoice sudah terbit — baris masih bisa dikoreksi. Total dan
              status menyesuaikan pembayaran tercatat.
            </p>
          )}

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
              value={pickerVariantId}
              onChange={(e) => addFromCatalog(e.target.value)}
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
              {!isDraft && (
                <span className="mt-0.5 block text-xs">
                  Dibayar {formatRupiah(Number(invoice.amount_paid))} · Sisa{" "}
                  <span className="font-semibold text-gray-900">
                    {formatRupiah(Number(invoice.balance_due))}
                  </span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {isDraft ? (
                <>
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
                </>
              ) : (
                <button
                  type="button"
                  onClick={saveLines}
                  disabled={
                    busy || hasLineIssues || lines.length === 0 || !bankId
                  }
                  title={
                    lines.length === 0
                      ? "Invoice terbit minimal memiliki satu baris"
                      : !bankId
                        ? "Pilih rekening bank"
                        : undefined
                  }
                  className={btnPrimary}
                >
                  {busy ? "…" : "Simpan Perubahan"}
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {!isEditable && (
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
                <span className="tabular-nums">
                  {formatRupiah(Number(invoice.amount_paid))}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold text-gray-900">
                <span>Sisa Tagihan</span>
                <span className="tabular-nums">
                  {formatRupiah(Number(invoice.balance_due))}
                </span>
              </div>
            </div>
          </Card>

          {isPayable && (
            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-gray-900">
                Pembayaran &amp; Pengiriman
              </h2>

              {Number(invoice.balance_due) > 0 ? (
                <div className="mb-4 flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor="payment" className={labelClass}>
                      Nominal Pembayaran
                    </label>
                    <input
                      id="payment"
                      type="number"
                      min={0.01}
                      max={Number(invoice.balance_due)}
                      step={0.01}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className={inputClass + " w-48"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={recordPayment}
                    disabled={
                      busy ||
                      !(Number(paymentAmount) > 0) ||
                      Number(paymentAmount) > Number(invoice.balance_due)
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
              <p className="mb-4 text-xs text-gray-400">
                Tautan bisa dibuka pelanggan tanpa login selama invoice belum
                dibatalkan.
              </p>

              <button
                type="button"
                onClick={() => setConfirmVoid(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Batalkan Invoice
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
        description="Invoice batal tidak bisa dilihat pelanggan dan tidak bisa diubah lagi. Nomor tidak dipakai ulang; buat invoice tidak bisa dilakukan karena satu booking hanya punya satu invoice."
        confirmLabel="Batalkan Invoice"
        busy={busy}
        onConfirm={voidInvoice}
        onClose={() => setConfirmVoid(false)}
      />
    </div>
  );
}
