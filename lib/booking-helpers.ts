import { supabase } from "./supabase";
import type { DateCapacity } from "./types";

/**
 * Returns capacity info for a date range so the calendar UI can
 * disable dates where booked_count >= max_capacity.
 */
export async function getDateCapacityRange(
  startDate: string,
  endDate: string,
): Promise<Record<string, DateCapacity>> {
  const { data, error } = await supabase
    .from("date_capacity")
    .select("*")
    .gte("event_date", startDate)
    .lte("event_date", endDate);

  if (error) throw error;

  const map: Record<string, DateCapacity> = {};
  for (const row of data ?? []) {
    map[row.event_date] = row as DateCapacity;
  }

  return map;
}

/** A date with no row yet is treated as fully open (default capacity 1). */
export function isDateAvailable(
  date: string,
  capacityMap: Record<string, DateCapacity>,
  defaultCapacity = 1,
): boolean {
  const row = capacityMap[date];
  if (!row) return true;
  return row.booked_count < row.max_capacity;
}

/**
 * Builds a wa.me deep link prefilled with a product inquiry. Since
 * there's no client-facing booking form, this is the main CTA on
 * product pages — customer picks a product, taps this, and finishes
 * the conversation (date, theme, payment) directly with the admin
 * over WhatsApp.
 */
export function buildWhatsAppInquiryLink(params: {
  phoneNumber: string; // business number, e.g. "6281234567890"
  productName: string;
  preferredDate?: string;
}): string {
  const { phoneNumber, productName, preferredDate } = params;
  const message =
    `Halo, saya tertarik dengan paket "${productName}".` +
    (preferredDate ? `\nTanggal yang diinginkan: ${preferredDate}` : "") +
    `\nMohon info lebih lanjut. Terima kasih!`;

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * wa.me link for general (non-product) inquiries — landing CTA, footer, etc.
 * Returns null when the business number isn't configured so callers can hide
 * the WhatsApp button instead of linking to a dead wa.me URL.
 */
export function buildGeneralWhatsAppLink(): string | null {
  const phoneNumber = process.env.NEXT_PUBLIC_BUSINESS_WA_NUMBER;
  if (!phoneNumber) return null;
  const message =
    "Halo Dyasaka Decoration, saya ingin bertanya tentang dekorasi balon.";
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * wa.me deep link with an arbitrary prefilled message — used for
 * admin-to-customer sends (e.g. handing over an invoice link).
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Normalizes an Indonesian phone number as typed in a booking
 * ("0812-3456-7890", "812...", "+62 812...") to the international
 * digit-only form wa.me expects ("6281234567890"). Falls back to
 * the stripped digits when nothing matches the local patterns.
 */
export function normalizePhoneToWa(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}
