import { Reveal } from "@/components/ui/reveal";
import { KartuFrame, Perforation, FieldLabel, ExamNumber } from "@/components/public/landing/kit";

const KOMPETENSI = [
  { label: "Bilangan", nilai: 84, warna: "bg-emerald-600" },
  { label: "Pengukuran", nilai: 70, warna: "bg-emerald-600" },
  { label: "Aljabar & Pola", nilai: 64, warna: "bg-amber-600" },
  { label: "Geometri", nilai: 36, warna: "bg-rose-600" },
  { label: "Pengolahan Data", nilai: 86, warna: "bg-emerald-600" },
];

/** Pratinjau produk nyata untuk Learning Analytics - contoh rapor lengkap sebagai "sobekan hasil" kartu. */
export function Analitik() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
        <Reveal>
          <h2 className="font-card-serif text-3xl font-semibold text-balance text-card-ink">
            Bukan hanya nilai akhir — AyoTKA juga memberikan kelebihan, kekurangan &amp; rekomendasi
          </h2>
          <p className="mt-4 font-card text-base leading-relaxed text-card-ink/65">
            Tiap tryout menghasilkan peta kompetensi per materi, lengkap dengan kelebihan, kekurangan,
            dan rekomendasi materi — supaya siswa tahu mana yang kurang dan perlu ditingkatkan.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <KartuFrame className="bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-card-ink/15 px-6 py-3.5">
              <FieldLabel>Sobekan Hasil &middot; Bilal, Kelas 6</FieldLabel>
              <ExamNumber className="text-xs">08/09</ExamNumber>
            </div>
            <div className="px-6 py-5">
              <p className="font-card text-sm text-card-ink/55">Tryout Matematika, percobaan ke-3</p>
              <div className="mt-4 flex flex-col gap-4">
                {KOMPETENSI.map((k) => (
                  <div key={k.label}>
                    <div className="mb-1.5 flex justify-between font-card text-sm text-card-ink/80">
                      <span>{k.label}</span>
                      <ExamNumber>{k.nilai}</ExamNumber>
                    </div>
                    <div className="h-2 overflow-hidden border border-card-ink/10 bg-card-paper">
                      <div className={`h-full ${k.warna}`} style={{ width: `${k.nilai}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Perforation />
            <div className="px-6 py-4">
              <FieldLabel>Catatan Pemeriksa</FieldLabel>
              <p className="mt-1.5 font-card text-sm leading-relaxed text-card-ink/70">
                Dari 8 soal Geometri, 6 salah di soal yang melibatkan bangun ruang. Konsep dasarnya
                sudah dipahami, tapi soal cerita bangun ruang masih perlu banyak latihan.
              </p>
            </div>
          </KartuFrame>
        </Reveal>
      </div>
    </section>
  );
}
