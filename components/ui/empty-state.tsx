import type { ReactNode } from "react";

/**
 * Bagian 7 panduan teknis: state kosong wajib berupa pesan ramah + aksi
 * berikutnya, bukan tabel/daftar kosong tanpa penjelasan.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="max-w-sm text-sm text-slate-500">{description}</p>
      {action}
    </div>
  );
}
