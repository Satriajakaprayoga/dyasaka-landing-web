"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type Props = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

function pageList(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "gap", total];
  if (current >= total - 2)
    return [1, "gap", total - 3, total - 2, total - 1, total];
  return [1, "gap", current - 1, current, current + 1, "gap", total];
}

export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: Props) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const idle =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40";
  const active =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium bg-gray-900 text-white";

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3"
      aria-label="Navigasi halaman"
    >
      <p className="text-xs text-gray-400">
        Menampilkan {from}–{to} dari {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
          className={idle}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {pageList(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={p === page ? active : idle}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Halaman berikutnya"
          className={idle}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
