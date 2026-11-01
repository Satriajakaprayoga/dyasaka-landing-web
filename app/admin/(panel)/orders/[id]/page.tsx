"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  TransactionCategory,
} from "@/lib/types";
import {
  Breadcrumbs,
  Card,
  EmptyState,
  OrderStatusBadge,
  Skeleton,
  btnPrimary,
  btnSecondary,
  formatDate,
  formatRupiah,
  inputClass,
  labelClass,
} from "@/components/admin/ui";
import { CheckIcon, PencilIcon, XIcon } from "@/components/admin/icons";
import ConfirmModal from "@/components/admin/ConfirmModal";

type OrderRow = PurchaseOrder & {
  supplier: { id: string; name: string; phone: string | null } | null;
  booking: { id: string; customer_name: string } | null;
};

type ItemRow = PurchaseOrderItem & {
  item_variants: {
    color: string | null;
    size: string | null;
    items: { name: string; type: string } | null;
  } | null;
};

type TxRow = {
  id: string;
  direction: string;
  amount: number;
  transaction_date: string;
  description: string | null;
  category: { name: string } | null;
};

function variantTitle(v: ItemRow["item_variants"]) {
  const details = [v?.color, v?.size].filter(Boolean).join(", ");
  const name = v?.items?.name ?? "Varian";
  return details ? `${name} (${details})` : name;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Receive flow (one line at a time).
  const [receivingLine, setReceivingLine] = useState<ItemRow | null>(null);
  const [receiveQty, setReceiveQty] = useState("1");

  // Payment form.
  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAccount, setPayAccount] = useState("");

  // Header edit (draft|ordered).
  const [editing, setEditing] = useState(false);
  const [editExpected, setEditExpected] = useState("");
  const [editNote, setEditNote] = useState("");

  const [confirmAction, setConfirmAction] = useState<"cancel" | "delete" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [orderRes, itemsRes, categoriesRes, txRes] = await Promise.all([
          supabase
            .from("purchase_orders")
            .select(
              "*, supplier:suppliers(id, name, phone), booking:bookings(id, customer_name)",
            )
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("purchase_order_items")
            .select(
              "*, item_variants(color, size, items(name, type))",
            )
            .eq("purchase_order_id", id)
            .order("id"),
          supabase
            .from("transaction_categories")
            .select("*")
            .eq("is_active", true)
            .eq("direction", "out")
            .order("sort_order"),
          supabase
            .from("transactions")
            .select(
              "id, direction, amount, transaction_date, description, category:transaction_categories(name)",
            )
            .eq("purchase_order_id", id)
            .order("transaction_date")
            .order("created_at"),
        ]);

        if (orderRes.error) throw new Error(orderRes.error.message);
        if (!orderRes.data) {
          setNotFound(true);
          return;
        }
        if (txRes.error) throw new Error(txRes.error.message);

        setOrder((orderRes.data ?? null) as unknown as OrderRow | null);
        setItems((itemsRes.data ?? []) as unknown as ItemRow[]);
        setCategories((categoriesRes.data ?? []) as TransactionCategory[]);
        setTxs((txRes.data ?? []) as unknown as TxRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat pesanan");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const total = items.reduce(
    (s, it) => s + it.quantity_ordered * Number(it.unit_cost),
    0,
  );
  const paid = txs
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + Number(t.amount), 0);
  const remaining = Math.max(total - paid, 0);

  async function patchAction(
    action: string,
    extra: Record<string, unknown> = {},
  ):
  Promise<{ order?: OrderRow; items?: ItemRow[]; paid?: number; remaining?: number; transaction?: TxRow } | null> {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/purchase-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });

      if (!res.ok) {
        let message = `Gagal (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return null;
      }

      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal terhubung ke server");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleOrder() {
    if (!confirm("Kirim pesanan ke supplier? Setelah dikirim, pesanan tidak bisa diedit lagi.")) return;
    const body = await patchAction("order");
    if (body?.order) setOrder(body.order);
  }

  function startEdit() {
    setEditExpected(order?.expected_date ?? "");
    setEditNote(order?.note ?? "");
    setEditing(true);
  }

  async function handleSaveHeader(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = await patchAction("save", {
      expected_date: editExpected,
      note: editNote,
    });
    if (body?.order) {
      setOrder(body.order);
      setEditing(false);
    }
  }

  async function performReceive() {
    if (!receivingLine) return;
    const body = await patchAction("receive", {
      lines: [{ id: receivingLine.id, quantity: Number(receiveQty) }],
    });
    if (body?.order) {
      setOrder(body.order);
      if (body.items) setItems(body.items);
      setReceivingLine(null);
      setReceiveQty("1");
    }
  }

  async function performPay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = await patchAction("pay", {
      amount: Number(payAmount),
      transaction_date: payDate,
      account: payAccount,
    });
    if (body?.transaction) {
      setTxs((ts) => [...ts, body.transaction as TxRow]);
      setPaying(false);
      setPayAmount("");
      setPayAccount("");
    }
  }

  async function performCancel() {
    const body = await patchAction("cancel");
    if (body?.order) setOrder(body.order);
  }

  async function performDelete() {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/purchase-orders?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        let message = `Gagal menghapus (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body.error) message = body.error;
        } catch {
          // HTML error page — keep the generic message.
        }
        setError(message);
        return;
      }

      router.push("/admin/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus pesanan");
    } finally {
      setConfirmAction(null);
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <EmptyState
        title="Pesanan tidak ditemukan"
        subtitle="Pesanan mungkin sudah dihapus."
      >
        <Link href="/admin/orders" className={btnSecondary}>
          Kembali ke daftar
        </Link>
      </EmptyState>
    );
  }

  const isActive = order.status === "ordered" || order.status === "partially_received";
  const headerEditable = order.status === "draft" || order.status === "ordered";
  const defaultCategory = categories.find((c) => c.name === "Goods purchase");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="mb-4">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Pembelian", href: "/admin/orders" },
              { label: order.supplier?.name ?? "Pesanan" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900">
              {order.supplier?.name ?? "Pesanan"}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {order.status === "draft" && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmAction("delete")}
                  disabled={busy}
                  className={btnSecondary}
                >
                  Hapus Draft
                </button>
                <button
                  type="button"
                  onClick={handleOrder}
                  disabled={busy}
                  className={btnPrimary}
                >
                  Kirim ke Supplier
                </button>
              </>
            )}
            {isActive && (
              <button
                type="button"
                onClick={() => setConfirmAction("cancel")}
                disabled={busy}
                className={btnSecondary}
              >
                Batalkan
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <Card className="mb-4 p-4">
        {editing ? (
          <form onSubmit={handleSaveHeader} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Target datang</label>
              <input
                type="date"
                value={editExpected}
                onChange={(e) => setEditExpected(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Catatan</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className={btnSecondary}
              >
                Batal
              </button>
              <button type="submit" disabled={busy} className={btnPrimary}>
                Simpan
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <dl className="grid flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-400">Telepon</dt>
                <dd className="text-gray-900">{order.supplier?.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Dipesan</dt>
                <dd className="text-gray-900">
                  {order.order_date ? formatDate(order.order_date) : "Belum dikirim"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Target datang</dt>
                <dd className="text-gray-900">
                  {order.expected_date ? formatDate(order.expected_date) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400">Untuk booking</dt>
                <dd className="text-gray-900">
                  {order.booking ? (
                    <Link
                      href={`/admin/bookings/${order.booking.id}`}
                      className="text-gray-900 underline decoration-gray-300 hover:decoration-gray-900"
                    >
                      {order.booking.customer_name}
                    </Link>
                  ) : (
                    "— Stok umum"
                  )}
                </dd>
              </div>
              {order.note && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-400">Catatan</dt>
                  <dd className="text-gray-900">{order.note}</dd>
                </div>
              )}
            </dl>
            {headerEditable && (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                Ubah
              </button>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <div className="border-b border-gray-100 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">Baris Pesanan</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2 font-medium">Varian</th>
              <th className="px-4 py-2 text-right font-medium">Dipesan</th>
              <th className="px-4 py-2 text-right font-medium">Diterima</th>
              <th className="px-4 py-2 text-right font-medium">Harga Pokok</th>
              <th className="px-4 py-2 text-right font-medium">Subtotal</th>
              <th className="px-4 py-2" aria-label="aksi" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((it) => {
              const lineRemaining = it.quantity_ordered - it.quantity_received;
              return (
                <tr key={it.id}>
                  <td className="px-4 py-2.5 text-gray-900">
                    {variantTitle(it.item_variants)}
                    {it.item_variants?.items?.type === "rentable" && (
                      <span className="block text-xs text-gray-400">rentable</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {it.quantity_ordered}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {it.quantity_received}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-700">
                    {formatRupiah(Number(it.unit_cost))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900">
                    {formatRupiah(it.quantity_ordered * Number(it.unit_cost))}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isActive && lineRemaining > 0 && (
                      receivingLine?.id === it.id ? (
                        <span className="text-xs text-gray-400">menerima…</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReceivingLine(it);
                            setReceiveQty(String(lineRemaining));
                          }}
                          disabled={busy}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
                        >
                          Terima
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {receivingLine && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performReceive();
            }}
            className="flex flex-wrap items-end gap-3 border-t border-gray-100 bg-gray-50 px-4 py-3"
          >
            <div className="text-sm text-gray-700">
              Terima <span className="font-medium">{variantTitle(receivingLine.item_variants)}</span> —
              sisa {receivingLine.quantity_ordered - receivingLine.quantity_received}
            </div>
            <div className="w-24">
              <label className={`${labelClass} text-xs`}>Jumlah</label>
              <input
                type="number"
                min={1}
                max={receivingLine.quantity_ordered - receivingLine.quantity_received}
                required
                value={receiveQty}
                onChange={(e) => setReceiveQty(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex gap-2 pb-0.5">
              <button
                type="button"
                onClick={() => setReceivingLine(null)}
                className={btnSecondary}
              >
                Batal
              </button>
              <button type="submit" disabled={busy} className={btnPrimary}>
                <CheckIcon className="h-4 w-4" />
                Terima
              </button>
            </div>
          </form>
        )}

        <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
          Menerima barang otomatis menambah stok (restock untuk consumable,
          purchased untuk rentable). Jika pesanan tertaut ke booking, baris
          checklist yang menunggu pembelian langsung jadi tersedia.
        </p>
      </Card>

      <Card className="p-4">
        <div className="mb-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-400">Total pesanan</p>
            <p className="text-sm font-semibold text-gray-900">
              {formatRupiah(total)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Dibayar</p>
            <p className="text-sm font-semibold text-green-700">
              {formatRupiah(paid)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Sisa</p>
            <p className="text-sm font-semibold text-red-700">
              {formatRupiah(remaining)}
            </p>
          </div>
        </div>

        {txs.length > 0 && (
          <ul className="mb-3 divide-y divide-gray-50 border-t border-gray-100 text-sm">
            {txs.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-gray-900">
                    {t.description ?? t.category?.name ?? "Pembayaran"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {[formatDate(t.transaction_date), t.category?.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-red-700">
                  −{formatRupiah(Number(t.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}

        {isActive && remaining > 0 && (
          paying ? (
            <form onSubmit={performPay} className="space-y-3 border-t border-gray-100 pt-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelClass}>Nominal</label>
                  <input
                    type="number"
                    min={1}
                    max={remaining}
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={String(remaining)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Tanggal</label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Akun (opsional)</label>
                  <input
                    type="text"
                    value={payAccount}
                    onChange={(e) => setPayAccount(e.target.value)}
                    placeholder="mis. Cash, BCA"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPaying(false)} className={btnSecondary}>
                  Batal
                </button>
                <button type="submit" disabled={busy} className={btnPrimary}>
                  Catat Pembayaran
                </button>
              </div>
            </form>
          ) : (
            <div className="border-t border-gray-100 pt-3 text-right">
              <button
                type="button"
                onClick={() => {
                  setPayAmount(String(remaining));
                  setPaying(true);
                }}
                className={btnPrimary}
              >
                Catat Pembayaran
              </button>
            </div>
          )
        )}

        <p className="mt-3 border-t border-gray-100 px-0 pt-3 text-xs text-gray-400">
          Pembayaran masuk ke buku kas sebagai pengeluaran (kategori{" "}
          {defaultCategory?.name ?? "Goods purchase"}) dan hanya dihitung di
          arus kas — biaya bahan untuk margin sudah masuk lewat harga pokok
          barang.
        </p>
      </Card>

      <ConfirmModal
        open={confirmAction !== null}
        title={
          confirmAction === "delete"
            ? "Hapus draft pesanan ini?"
            : "Batalkan pesanan ini?"
        }
        description="Tindakan ini tidak dapat dibatalkan."
        busy={busy}
        onConfirm={confirmAction === "delete" ? performDelete : performCancel}
        onClose={() => setConfirmAction(null)}
      >
        {confirmAction === "delete" ? (
          <p className="text-gray-600">
            Semua baris di dalamnya ikut terhapus. Rencana yang tertaut akan
            kembali terbuka.
          </p>
        ) : (
          <p className="text-gray-600">
            Rencana yang tertaut akan kembali terbuka. Pesanan yang sudah
            dikirim ke supplier sebaiknya ditelepon dulu sebelum dibatalkan.
          </p>
        )}
      </ConfirmModal>
    </div>
  );
}
