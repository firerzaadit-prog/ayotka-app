import { Reveal } from "@/components/ui/reveal";
import { ExamNumber } from "@/components/public/landing/kit";

const LANGKAH = [
  {
    judul: "Kerjakan tryout",
    deskripsi: "Jumlah soal, waktu, dan tingkat kesulitan mengikuti format TKA sesuai jenjangnya.",
  },
  {
    judul: "Jawaban dipetakan",
    deskripsi: "Tiap soal berisi jenis materinya, jadi sistem tahu letak kesalahan ada di materi mana.",
  },
  {
    judul: "Kelebihan, kelemahan & rekomendasi",
    deskripsi: "Dapat analisis kelebihan, kekurangan, dan rekomendasi belajar setelah mengerjakan TKA.",
  },
];

export function CaraKerja() {
  return (
    <section id="cara-kerja" className="card-paper-texture scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-card-serif text-3xl font-semibold text-balance text-card-ink">
            Tiga langkah, dari mengerjakan TKA hingga tahu rekomendasi belajarnya
          </h2>
        </Reveal>
        <div className="border border-card-ink/15 bg-white">
          {LANGKAH.map((l, i) => (
            <Reveal key={l.judul} delay={i * 80}>
              <div
                className={`flex gap-5 px-5 py-5 sm:px-8 ${i > 0 ? "border-t border-card-ink/10" : ""}`}
              >
                <ExamNumber className="w-8 shrink-0 text-2xl font-normal text-card-ink/30">
                  {String(i + 1).padStart(2, "0")}
                </ExamNumber>
                <div>
                  <h3 className="font-card text-base font-semibold text-card-ink">{l.judul}</h3>
                  <p className="mt-1.5 font-card text-sm leading-relaxed text-card-ink/65">{l.deskripsi}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
