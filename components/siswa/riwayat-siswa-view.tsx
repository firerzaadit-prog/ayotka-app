import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnalisisAiPanel } from "@/components/ai/analisis-panel";
import { RincianJawaban } from "@/components/hasil/rincian-jawaban";
import { KesiapanSiswaSummary } from "@/components/analytics/kesiapan-siswa-summary";
import { klasifikasiKesiapan } from "@/lib/exam/scoring";
import { KATEGORI_LABEL, KATEGORI_BADGE_VARIANT, type KesiapanSiswaPerMapel } from "@/lib/analytics/kesiapan";
import type { buildHasil } from "@/lib/exam/hasil";

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

const JALUR_LABEL: Record<string, string> = { A: "Jalur A (sekolah)", B: "Jalur B (mandiri)" };

export type AttemptRiwayat = {
  id: string;
  status: string;
  skorAkhir: number | null;
  mulaiAt: Date;
  selesaiAt: Date | null;
  package: { nama: string; subject: { nama: string } };
};

export type StudentRiwayat = {
  nama: string;
  nisn: string | null;
  jalur: string;
  school: { nama: string } | null;
  attempts: AttemptRiwayat[];
};

/**
 * Halaman detail riwayat 1 siswa: kategori Kesiapan TKA per mata pelajaran
 * (skor terbaik, sama seperti tabel drill-down agregat) berdampingan dengan
 * riwayat tiap attempt/paket yang pernah dikerjakan - tiap attempt juga
 * ditandai kategori kesiapan dari skornya SENDIRI (bukan skor terbaik),
 * supaya kelihatan attempt mana yang "kurang" dan mana yang sudah
 * "memadai"/"baik", bukan cuma status gabungan per mapel.
 *
 * Dipakai bareng oleh admin sekolah, admin pusat, dan dinas pendidikan -
 * masing-masing halaman yang menaruh komponen ini yang menangani auth &
 * scoping datanya sendiri (lihat page.tsx di app/admin-sekolah/siswa/[id],
 * app/admin-pusat/siswa/[id], app/dinas-pendidikan/siswa/[id]).
 */
export function RiwayatSiswaView({
  student,
  kesiapanPerMapel,
  hasilByAttempt,
  backHref,
  backLabel,
  canTrigger,
}: {
  student: StudentRiwayat;
  kesiapanPerMapel: KesiapanSiswaPerMapel[];
  hasilByAttempt: Map<string, Awaited<ReturnType<typeof buildHasil>>>;
  backHref: string;
  backLabel: string;
  /** Bisa memicu "Analisis ulang" AI - false untuk dinas pendidikan (akses baca saja). */
  canTrigger: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          {backLabel}
        </Link>
        <PageHeader
          title={`Detail Riwayat: ${student.nama}`}
          description={`NISN: ${student.nisn || "-"} • ${JALUR_LABEL[student.jalur] || student.jalur} • Sekolah: ${student.school?.nama || "Siswa Mandiri"}`}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Kesiapan TKA per Mata Pelajaran</h2>
          <p className="text-sm text-slate-500">
            Berdasarkan skor terbaik siswa ini di tiap mapel & kategori capaian resmi Kemendikdasmen.
          </p>
        </div>
        <KesiapanSiswaSummary data={kesiapanPerMapel} />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Riwayat Ujian (Attempts)</h2>
        {student.attempts.length === 0 ? (
          <p className="text-sm text-slate-500">Siswa ini belum pernah mengerjakan ujian apa pun.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {student.attempts.map((a) => {
              const kategoriAttempt =
                a.skorAkhir !== null ? klasifikasiKesiapan(a.package.subject.nama, a.skorAkhir) : null;
              return (
                <Card key={a.id} className="flex flex-col gap-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <h3 className="font-medium text-slate-900">{a.package.nama}</h3>
                      <Badge
                        variant={
                          a.status === "selesai" ? "success" :
                          a.status === "berjalan" ? "warning" :
                          "neutral"
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">{a.package.subject.nama}</p>
                    <p className="text-xs text-slate-500">Mulai: {FORMAT_TANGGAL.format(a.mulaiAt)}</p>
                    {a.selesaiAt && (
                      <p className="text-xs text-slate-500">Selesai: {FORMAT_TANGGAL.format(a.selesaiAt)}</p>
                    )}
                  </div>

                  <div className="flex justify-between items-end border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-xs text-slate-500">Skor Akhir</p>
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-slate-900">
                          {a.skorAkhir !== null ? a.skorAkhir.toFixed(1) : "-"}
                        </p>
                        {kategoriAttempt !== null && (
                          <Badge variant={KATEGORI_BADGE_VARIANT[kategoriAttempt]}>
                            {KATEGORI_LABEL[kategoriAttempt]}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {a.status === "selesai" && (
                      <a href={`/api/siswa/attempts/${a.id}/rapor`} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                        Unduh Rapor (PDF) →
                      </a>
                    )}
                  </div>

                  {a.status === "selesai" && (
                    <div className="border-t border-slate-100 pt-4">
                      <AnalisisAiPanel attemptId={a.id} canTrigger={canTrigger} />
                    </div>
                  )}

                  {a.status === "selesai" && hasilByAttempt.get(a.id) && (() => {
                    const h = hasilByAttempt.get(a.id)!;
                    return (
                      <details className="border-t border-slate-100 pt-4">
                        <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                          Rincian Jawaban ({h.perSoal.length} soal)
                        </summary>
                        <div className="mt-3">
                          <RincianJawaban perSoal={h.perSoal} canShowPembahasan={h.canShowPembahasan} />
                        </div>
                      </details>
                    );
                  })()}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
