import { Card } from "@/components/ui/card";
import { rentangAngka, type KelompokSeri } from "@/lib/exam/seri-jadwal";

/**
 * Panel "posisi urutan seri" di Bank Soal admin pusat (permintaan user, 5 Okt 2026): per mapel dan jenjang, urutan mana
 * yang sudah terbit, draft, celah nomor, nomor berikutnya, dan sejauh mana siswa sudah menyelesaikan paket. Datanya dari
 * ringkasSeri (lib/exam/seri-jadwal.ts). `tampilkanSiswa` = false kalau jumlah siswa gagal dimuat (angka disembunyikan,
 * bukan ditampilkan sebagai 0).
 */
export function RingkasanSeri({ kelompok, tampilkanSiswa }: { kelompok: KelompokSeri[]; tampilkanSiswa: boolean }) {
  if (kelompok.length === 0) return null;
  return (
    <Card data-testid="ringkasan-seri">
      <h2 className="text-sm font-bold text-slate-900">Posisi Urutan Seri Try Out Mandiri</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Siswa membuka paket berurutan per mapel dan jenjang: satu paket baru per hari setelah paket sebelumnya selesai.
        Berikut urutan yang sudah terpakai{tampilkanSiswa ? " dan sejauh mana siswa sudah maju" : ""}.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {kelompok.map((g) => (
          <div key={g.kunci} data-testid="kelompok-seri" className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {g.mapel}{" "}
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">{g.jenjang}</span>
              </p>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                Urutan berikutnya: #{g.berikutnya}
              </span>
            </div>

            <p className="mt-1.5 text-xs text-slate-700" data-testid="posisi-terbit">
              {g.terbitTerakhir != null ? (
                <>
                  Terbit sampai urutan ke-<b>{g.terbitTerakhir}</b>
                  {g.draft.length > 0 && <> · draft: #{rentangAngka(g.draft)}</>}
                </>
              ) : (
                <>Belum ada yang terbit{g.draft.length > 0 && <> · draft: #{rentangAngka(g.draft)}</>}</>
              )}
            </p>

            {tampilkanSiswa && (
              <p className="mt-0.5 text-xs text-slate-700" data-testid="posisi-siswa">
                {g.selesaiTertinggi ? (
                  <>
                    Siswa terdepan sudah menyelesaikan urutan ke-<b>{g.selesaiTertinggi.urutan}</b> ({g.selesaiTertinggi.siswa} siswa)
                  </>
                ) : (
                  <>Belum ada siswa yang menyelesaikan paket di seri ini</>
                )}
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.paket.map((p) => (
                <span
                  key={p.id}
                  title={`${p.nama} - ${p.status}${tampilkanSiswa ? ` - ${p.siswaSelesai} siswa sudah menyelesaikan` : ""}`}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    p.status === "published"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-dashed border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  #{p.urutan}
                  {tampilkanSiswa && <span className="font-normal">· {p.siswaSelesai} siswa</span>}
                </span>
              ))}
            </div>

            {g.celah.length > 0 && (
              <p className="mt-2 text-[11px] text-amber-700" data-testid="celah-seri">
                Nomor #{rentangAngka(g.celah)} belum dipakai paket mana pun. Tidak masalah bagi siswa (urutan tetap
                berjalan), hanya kurang rapi.
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
