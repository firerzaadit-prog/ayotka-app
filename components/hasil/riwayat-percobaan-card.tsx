import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatWIB } from "@/lib/utils/datetime";
import { percobaanTerbaik, type PercobaanItem } from "@/lib/exam/percobaan";

function Selisih({ nilai }: { nilai: number | null }) {
  if (nilai == null) return <span className="text-xs text-slate-400">Percobaan awal</span>;
  if (nilai > 0) {
    return (
      <span className="text-xs font-semibold text-emerald-600" aria-label={`naik ${nilai} poin`}>
        ▲ +{nilai}
      </span>
    );
  }
  if (nilai < 0) {
    return (
      <span className="text-xs font-semibold text-rose-600" aria-label={`turun ${Math.abs(nilai)} poin`}>
        ▼ {nilai}
      </span>
    );
  }
  return <span className="text-xs font-semibold text-slate-500">Sama</span>;
}

/**
 * Kartu di halaman hasil: semua percobaan SELESAI siswa pada paket yang sama
 * (Percobaan 1, 2, 3, ...) dengan skor, tanggal, dan naik/turun dibanding
 * percobaan sebelumnya. Hanya tampil kalau ada >= 2 percobaan - untuk satu
 * percobaan tidak ada yang bisa dibandingkan. Data dari
 * susunRiwayatPercobaan (lib/exam/percobaan.ts) lewat GET /api/siswa/attempts/[id].
 */
export function RiwayatPercobaanCard({ items }: { items: PercobaanItem[] }) {
  if (items.length < 2) return null;
  const terbaik = percobaanTerbaik(items);

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Percobaan pada Paket Ini</h2>
        {terbaik && terbaik.skorAkhir != null && (
          <p className="text-xs text-slate-500">
            Skor terbaik:{" "}
            <span className="font-semibold text-slate-800">{Math.round(terbaik.skorAkhir)}</span> (Percobaan{" "}
            {terbaik.nomor})
          </p>
        )}
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">Percobaan {it.nomor}</p>
                {it.iniYangDibuka && <Badge variant="info">Sedang dilihat</Badge>}
                {it.status === "kedaluwarsa" && <Badge variant="neutral">Waktu habis</Badge>}
              </div>
              <p className="text-xs text-slate-500">{formatWIB(it.mulaiAt, "EEEE, d MMM yyyy HH.mm")}</p>
            </div>

            <div className="flex shrink-0 items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-xl font-bold leading-none text-slate-900">
                  {it.skorAkhir != null ? Math.round(it.skorAkhir) : "-"}
                </span>
                <Selisih nilai={it.selisih} />
              </div>
              {it.iniYangDibuka ? (
                <span className="w-16" />
              ) : (
                <Link href={`/siswa/hasil/${it.id}`} className="w-16 text-right text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  Lihat hasil
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
