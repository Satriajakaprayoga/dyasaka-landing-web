"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { buildWhatsAppInquiryLink } from "@/lib/booking-helpers";

const BUSINESS_WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_BUSINESS_WA_NUMBER ?? "";

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-100";

const labelClass = "mb-1.5 block text-xs font-medium text-gray-600";

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * "Booking Sekarang" trigger button + modal form. Visitors (anon) insert
 * a pending booking directly — allowed by the "public insert bookings"
 * RLS policy (status/project_status forced by the DB defaults, product
 * must be active). The insert deliberately uses no `.select()` because
 * anon has no SELECT policy on bookings.
 */
export default function BookingModal({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [address, setAddress] = useState("");
  const [theme, setTheme] = useState("");
  const [message, setMessage] = useState("");

  const nameRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const resetForm = useCallback(() => {
    setName("");
    setPhone("");
    setDate("");
    setAddress("");
    setTheme("");
    setMessage("");
  }, []);

  // Scroll lock, Escape to close, focus in/out while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    nameRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [open, close]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const digits = phone.replace(/\D/g, "");
    if (name.trim().length === 0) return setError("Nama wajib diisi.");
    if (digits.length < 8 || digits.length > 15) {
      return setError("Nomor WhatsApp tidak valid (8–15 digit).");
    }
    if (!date) return setError("Tanggal acara wajib dipilih.");
    if (date < todayISO()) return setError("Tanggal acara tidak boleh sudah lewat.");
    if (address.trim().length === 0) return setError("Alamat acara wajib diisi.");

    setSubmitting(true);
    const { error: insertError } = await supabase.from("bookings").insert({
      product_id: productId,
      customer_name: name.trim(),
      phone: phone.trim(),
      event_date: date,
      event_address: address.trim(),
      theme: theme.trim() || null,
      message: message.trim() || null,
    });
    setSubmitting(false);

    if (insertError) {
      setError(
        "Booking gagal terkirim. Periksa kembali data Anda, lalu coba lagi " +
          "atau hubungi admin via WhatsApp."
      );
      return;
    }
    setSucceeded(true);
  };

  const handleCloseAfterSuccess = () => {
    close();
    setSucceeded(false);
    resetForm();
  };

  const waFollowUp = buildWhatsAppInquiryLink({
    phoneNumber: BUSINESS_WHATSAPP_NUMBER,
    productName,
    preferredDate: date || undefined,
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-pink-600 bg-white px-5 py-3 text-sm font-semibold text-pink-600 transition hover:bg-pink-50 active:scale-[0.98]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        </svg>
        Booking Sekarang
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Booking ${productName}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            {succeeded ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7 text-green-600"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <h2 className="mt-4 text-lg font-bold text-gray-900">Booking Terkirim!</h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
                  Booking Anda untuk <span className="font-medium text-gray-700">{productName}</span>{" "}
                  pada {date} sudah kami terima dengan status{" "}
                  <span className="font-medium text-amber-600">menunggu konfirmasi</span>.
                  Admin akan menghubungi Anda via WhatsApp.
                </p>
                <a
                  href={waFollowUp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 w-full rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.98]"
                >
                  Follow-up via WhatsApp
                </a>
                <button
                  type="button"
                  onClick={handleCloseAfterSuccess}
                  className="mt-2 w-full rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 active:scale-[0.98]"
                >
                  Selesai
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Booking Paket</h2>
                    <p className="mt-0.5 text-sm text-gray-500">{productName}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Tutup"
                    onClick={close}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <div>
                    <label htmlFor="bk-name" className={labelClass}>
                      Nama Lengkap <span className="text-pink-600">*</span>
                    </label>
                    <input
                      id="bk-name"
                      ref={nameRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      required
                      placeholder="cth: Budi Santoso"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="bk-phone" className={labelClass}>
                      No. WhatsApp <span className="text-pink-600">*</span>
                    </label>
                    <input
                      id="bk-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="cth: 0812xxxxxxx"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="bk-date" className={labelClass}>
                      Tanggal Acara <span className="text-pink-600">*</span>
                    </label>
                    <input
                      id="bk-date"
                      type="date"
                      value={date}
                      min={todayISO()}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Cek kalender ketersediaan di bawah sebelum memilih tanggal.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="bk-address" className={labelClass}>
                      Alamat Acara <span className="text-pink-600">*</span>
                    </label>
                    <textarea
                      id="bk-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      maxLength={500}
                      required
                      rows={2}
                      placeholder="Nama gedung/rumah, jalan, kota"
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  <div>
                    <label htmlFor="bk-theme" className={labelClass}>
                      Tema Dekorasi{" "}
                      <span className="font-normal text-gray-400">(opsional)</span>
                    </label>
                    <input
                      id="bk-theme"
                      type="text"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      maxLength={200}
                      placeholder="cth: Tema pastel unicorn"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="bk-message" className={labelClass}>
                      Catatan{" "}
                      <span className="font-normal text-gray-400">(opsional)</span>
                    </label>
                    <textarea
                      id="bk-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={1000}
                      rows={2}
                      placeholder="Pertanyaan atau permintaan khusus"
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  {error && (
                    <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-pink-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Mengirim..." : "Kirim Booking"}
                  </button>
                  <p className="text-center text-xs text-gray-400">
                    Booking masuk dengan status menunggu konfirmasi. Gratis, tanpa
                    pembayaran di langkah ini.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
