import { Reveal } from "@/components/ui/reveal";
import { KartuFrame, FieldLabel } from "@/components/public/landing/kit";

const BARIS = [
  { aspek: "Soal sesuai kerangka asesmen resmi Kemendikdasmen", simulasi: true, ayotka: true },
  { aspek: "Format soal sama dengan Tes Kemampuan Akademik", simulasi: true, ayotka: true },
  { aspek: "Ada rincian per materi, bukan cuma nilai akhir", simulasi: false, ayotka: true },
  { aspek: "Riwayat percobaan tersimpan", simulasi: false, ayotka: true },
  { aspek: "Rekomendasi materi lanjutan otomatis", simulasi: false, ayotka: true },
  { aspek: "Guru/sekolah bisa memantau satu kelas sekaligus", simulasi: false, ayotka: true },
];

function Tanda({ ada }: { ada: boolean }) {
  return ada ? (
    <span className="font-card-mono text-card-ink" aria-label="Ada">✓</span>
  ) : (
    <span className="font-card-mono text-card-ink/25" aria-label="Tidak ada">–</span>
  );
}

export function Beda() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-card-serif text-3xl font-semibold text-balance text-card-ink">
            Apa kelebihan platform AyoTKA?
          </h2>
        </Reveal>
        <Reveal>
          <KartuFrame className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left font-card text-sm">
              <thead>
                <tr className="border-b border-card-ink/15">
                  <th className="px-5 py-3.5">
                    <FieldLabel>Aspek</FieldLabel>
                  </th>
                  <th className="px-5 py-3.5 text-center">
                    <FieldLabel>Simulasi Kemendikdasmen</FieldLabel>
                  </th>
                  <th className="bg-card-ink/5 px-5 py-3.5 text-center">
                    <FieldLabel className="text-card-ink/80">AyoTKA</FieldLabel>
                  </th>
                </tr>
              </thead>
              <tbody>
                {BARIS.map((b) => (
                  <tr key={b.aspek} className="border-b border-card-ink/10 last:border-0">
                    <td className="px-5 py-3.5 text-card-ink/80">{b.aspek}</td>
                    <td className="px-5 py-3.5 text-center">
                      <Tanda ada={b.simulasi} />
                    </td>
                    <td className="bg-card-ink/5 px-5 py-3.5 text-center">
                      <Tanda ada={b.ayotka} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </KartuFrame>
        </Reveal>
      </div>
    </section>
  );
}
