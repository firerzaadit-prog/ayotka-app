import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KATEGORI_LABEL, KATEGORI_BADGE_VARIANT } from "@/lib/analytics/kesiapan";
import type { KesiapanSiswaPerMapel } from "@/lib/analytics/kesiapan";

/**
 * Kesiapan TKA satu siswa per mata pelajaran (skor terbaik + kategori resmi
 * Kemendikdasmen) - dipakai di halaman detail riwayat siswa admin sekolah/
 * admin pusat/dinas pendidikan, berdampingan dengan riwayat attempt-nya.
 */
export function KesiapanSiswaSummary({ data }: { data: KesiapanSiswaPerMapel[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {data.map((m) => (
        <Card key={m.subjectNama} className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-slate-500">{m.subjectNama}</p>
          {m.kategori === null ? (
            <p className="text-xs text-slate-400">Belum ada data</p>
          ) : (
            <>
              <p className="font-mono text-lg font-bold text-slate-900">{m.skorTerbaik!.toFixed(1)}</p>
              <Badge variant={KATEGORI_BADGE_VARIANT[m.kategori]}>{KATEGORI_LABEL[m.kategori]}</Badge>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}
