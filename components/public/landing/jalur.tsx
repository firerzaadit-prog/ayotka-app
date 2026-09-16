import { Reveal } from "@/components/ui/reveal";
import { KartuFrame, FieldLabel } from "@/components/public/landing/kit";

const JALUR = [
  {
    label: "Jalur sekolah",
    judul: "Sekolah berlangganan",
    deskripsi: "Sekolah mendapat kuota kursi, lalu mengelola siswa dan jadwal tes lewat akun Admin Sekolah.",
    poin: [
      "Siswa masuk memakai kode kelas dari sekolah",
      "Admin Sekolah mengatur peserta & jadwal",
      "Rekap nilai satu angkatan dalam satu tempat",
    ],
  },
  {
    label: "Jalur mandiri",
    judul: "Siswa mendaftar sendiri",
    deskripsi: "Tanpa menunggu sekolah — mulai dari paket gratis, lalu berlangganan kapan pun siap.",
    poin: [
      "Coba gratis: 1 tryout per mapel, tanpa kartu",
      "Berlangganan bulanan atau semester, berhenti kapan saja",
      "Riwayat hasil tetap bisa dibuka setelah berhenti",
    ],
  },
];

export function Jalur() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto mb-10 max-w-xl text-center">
          <h2 className="font-card-serif text-3xl font-semibold text-balance text-card-ink">
            Lewat sekolah, atau langsung sebagai siswa mandiri
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {JALUR.map((j, i) => (
            <Reveal key={j.judul} delay={i * 80}>
              <KartuFrame className="h-full bg-white">
                <div className="border-b border-card-ink/15 px-6 py-3">
                  <FieldLabel>{j.label}</FieldLabel>
                </div>
                <div className="p-6">
                  <h3 className="font-card-serif text-lg font-semibold text-card-ink">{j.judul}</h3>
                  <p className="mt-2 font-card text-sm text-card-ink/65">{j.deskripsi}</p>
                  <ul className="mt-4 flex flex-col gap-2">
                    {j.poin.map((p) => (
                      <li key={p} className="flex gap-2 font-card text-sm text-card-ink/70">
                        <span className="mt-0.5 shrink-0 font-card-mono text-card-ink">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </KartuFrame>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
