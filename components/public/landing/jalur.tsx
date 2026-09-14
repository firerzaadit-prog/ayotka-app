import { Reveal } from "@/components/ui/reveal";

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
    <section className="bg-slate-50/70 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-12 max-w-xl text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Ada dua jalur pendaftaran
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900">
            Lewat sekolah, atau langsung sebagai siswa mandiri
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {JALUR.map((j, i) => (
            <Reveal key={j.judul} delay={i * 80}>
              <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-6 py-2.5 font-mono text-[0.68rem] font-medium uppercase tracking-wide text-slate-400">
                  {j.label}
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-slate-900">{j.judul}</h3>
                  <p className="mt-2 text-sm text-slate-600">{j.deskripsi}</p>
                  <ul className="mt-4 flex flex-col gap-2">
                    {j.poin.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-slate-600">
                        <span className="mt-0.5 shrink-0 font-bold text-indigo-600">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
