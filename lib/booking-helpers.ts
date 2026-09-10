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
