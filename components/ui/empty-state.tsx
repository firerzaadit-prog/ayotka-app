import type { ReactNode } from "react";

/**
 * Bagian 7 panduan teknis: state kosong wajib berupa pesan ramah + aksi
 * berikutnya, bukan tabel/daftar kosong tanpa penjelasan.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 rounded-2xl border border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/40 via-white to-slate-50/30 px-6 py-14 text-center">
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-8 ring-indigo-50/50 shadow-xs transition-transform duration-300 hover:scale-105">
          {icon}
        </div>
      )}
      <div className="flex flex-col items-center gap-1">
        <p className="text-base font-bold text-slate-900">{title}</p>
        <p className="max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
