import Link from "next/link";
import { formatWIB } from "@/lib/utils/datetime";

export type ItemRiwayatKartu = {
  id: string;
  /** Percobaan ke-N pada ujian/paket yang sama (lib/exam/percobaan.ts). */
  percobaanKe: number;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  skorAkhir: number | null;
  mulaiAt: string;
};

const LABEL_STATUS: Record<ItemRiwayatKartu["status"], string> = {
  berjalan: "Sedang berjalan",
  paused: "Dijeda admin",
  selesai: "Selesai",
  kedaluwarsa: "Waktu habis",
};

/**
 * Riwayat SEMUA percobaan siswa pada satu ujian/paket, ditampilkan di kartu ujian dan halaman petunjuk: mengerjakan
 * ulang tidak pernah menyembunyikan percobaan sebelumnya (permintaan user, 8 Okt 2026). Urut dari percobaan pertama;
 * yang terakhir diberi penanda "Terbaru". Terbuka otomatis bila ada lebih dari satu percobaan.
 */
export function RiwayatPercobaanKartu({ items, className = "" }: { items: ItemRiwayatKartu[]; className?: string }) {
  if (items.length === 0) return null;
  const urut = [...items].sort((a, b) => a.percobaanKe - b.percobaanKe || Date.parse(a.mulaiAt) - Date.parse(b.mulaiAt));
  return (
    <details open={urut.length > 1} data-riwayat-percobaan className={`rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 ${className}`}>
      <summary className="cursor-pointer text-xs font-semibold text-slate-700">Riwayat percobaan ({urut.length})</summary>
      <ol className="mt-2 flex flex-col gap-1.5">
        {urut.map((p, i) => {
          const berakhir = p.status === "selesai" || p.status === "kedaluwarsa";
          return (
            <li key={p.id} data-percobaan={p.percobaanKe} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">Percobaan ke-{p.percobaanKe}</span>
              {i === urut.length - 1 && urut.length > 1 && (
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">Terbaru</span>
              )}
              <span>{formatWIB(p.mulaiAt)}</span>
              <span>{LABEL_STATUS[p.status]}</span>
              {berakhir && p.skorAkhir !== null && (
                <span className="font-semibold text-slate-900">Nilai {Math.round(p.skorAkhir)}</span>
              )}
              {berakhir && (
                <Link href={`/siswa/hasil/${p.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                  Lihat hasil
                </Link>
              )}
              {p.status === "berjalan" && (
                <Link href={`/siswa/attempt/${p.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                  Lanjutkan
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
