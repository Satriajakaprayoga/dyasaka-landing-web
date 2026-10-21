"use client";

/**
 * The PDF is produced by the browser's own print dialog ("Save as
 * PDF") — no PDF library. Hidden when actually printing.
 */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 print:hidden"
    >
      Unduh PDF / Cetak
    </button>
  );
}
