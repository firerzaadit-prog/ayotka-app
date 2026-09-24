import { Reveal } from "@/components/ui/reveal";

/**
 * Mockup ini SENGAJA meniru struktur & warna asli halaman hasil siswa
 * (app/siswa/(shell)/hasil/[id]/page.tsx: kartu Nilai -> Peta Kompetensi
 * lewat PetaKompetensiChart -> AnalisisAiPanel) supaya calon pengguna yang
 * belum daftar melihat produk sungguhan, bukan ilustrasi yang berbeda dari
 * kenyataan. Ambang & warna 3-tier disalin dari lib/exam/competency-color.ts
 * ("baik" >=70 emerald, "cukup" 50-69 amber, "kurang" <50 rose) - JANGAN
 * diubah sendiri-sendiri dari sumber aslinya supaya tidak ada dua definisi
 * warna yang beda kalau ambangnya nanti direvisi.
 */
const KOMPETENSI = [
  { label: "Bilangan", persentase: 84, bar: "bg-emerald-600", text: "text-emerald-700" },
  { label: "Pengukuran", persentase: 70, bar: "bg-emerald-600", text: "text-emerald-700" },
  { label: "Aljabar & Pola", persentase: 64, bar: "bg-amber-600", text: "text-amber-700" },
  { label: "Geometri", persentase: 36, bar: "bg-rose-600", text: "text-rose-700" },
  { label: "Pengolahan Data", persentase: 86, bar: "bg-emerald-600", text: "text-emerald-700" },
];

export function Analitik() {
  return (
    <section id="peta-kompetensi" className="scroll-mt-20 bg-slate-50/70 px-6 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
        <Reveal>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Learning analytics
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
            Bukan hanya nilai akhir — AyoTKA juga memberikan kelebihan, kekurangan &amp; rekomendasi
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Tiap tryout menghasilkan peta kompetensi per materi, lengkap dengan kelebihan, kekurangan,
            dan rekomendasi materi — supaya siswa tahu mana yang kurang dan perlu ditingkatkan.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                Contoh rapor — Bilal, Kelas 6
              </p>
              <p className="mt-0.5 text-sm text-slate-500">Tryout Matematika, percobaan ke-3 · 8 September</p>
            </div>

            <div className="border-b border-slate-100 px-6 py-5">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Peta Kompetensi</h3>
              <div className="flex flex-col gap-3">
                {KOMPETENSI.map((k) => (
                  <div key={k.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-900">{k.label}</span>
                      <span className={`font-mono text-xs font-semibold ${k.text}`}>{k.persentase}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${k.bar}`} style={{ width: `${k.persentase}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" /> Baik (≥70%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-600" /> Cukup (50-69%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-600" /> Perlu latihan (&lt;50%)
                </span>
              </div>
            </div>

            <div className="px-6 py-5">
              <h3 className="mb-3 text-base font-semibold text-slate-900">Analisis AI</h3>
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Ringkasan Kemampuan</p>
                  <p className="text-slate-700">
                    Bilal sudah kuat di Bilangan dan Pengolahan Data, tapi masih perlu banyak latihan di Geometri.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Kekurangan Siswa</p>
                  <p className="text-slate-600">
                    Dari 8 soal Geometri, 6 salah di soal yang melibatkan bangun ruang. Konsep dasarnya
                    sudah dipahami, tapi soal cerita bangun ruang masih perlu banyak latihan.
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Rekomendasi Belajar</p>
                  <ul className="list-disc pl-4 text-slate-600">
                    <li>Latihan soal cerita bangun ruang (kubus &amp; balok) 15 menit/hari.</li>
                    <li>Ulangi materi Aljabar &amp; Pola sebelum tryout berikutnya.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
