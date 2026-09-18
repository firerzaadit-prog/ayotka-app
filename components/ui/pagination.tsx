"use client";

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

/** Navigasi halaman + pilihan baris/halaman untuk tabel yang datanya sudah diambil penuh ke client. */
export function Pagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}) {
  if (totalItems === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-slate-500">
          Halaman {page} dari {totalPages} &middot; {totalItems} data
        </p>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Baris/halaman
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-xs transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700"
          >
            Selanjutnya
          </button>
        </div>
      )}
    </div>
  );
}
