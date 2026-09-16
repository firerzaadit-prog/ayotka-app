import { Reveal } from "@/components/ui/reveal";

const FAQ = [
  {
    q: "Saya sudah ada simulasi gratis dari pemerintah. Kenapa harus bayar?",
    a: "Kalau tujuannya cuma membiasakan anak dengan format soal, simulasi gratis sudah cukup dan sebaiknya tetap dipakai. Yang tidak diberikan di sana adalah rincian per materi dan riwayat perkembangan. Kalau anak sudah beberapa kali tryout dan nilainya jalan di tempat, biasanya masalahnya bukan kurang latihan, tapi latihannya tidak mengarah ke materi yang bermasalah — bagian itu yang kami kerjakan.",
  },
  {
    q: "TKA itu wajib, ya? Anak saya harus ikut?",
    a: "Tidak wajib dan bukan penentu kelulusan. TKA dipakai untuk memotret kemampuan akademik secara terstandar, dan hasilnya bisa dipakai sebagai salah satu pertimbangan di jalur prestasi SPMB. Jadi keputusan ikut atau tidak ada di keluarga masing-masing.",
  },
  {
    q: "Anak saya belum bisa pakai HP atau komputer sendiri, bagaimana daftarnya?",
    a: "Login memakai NISN dan PIN, bukan nomor HP atau email pribadi — satu nomor WhatsApp orang tua bisa dipakai untuk mendaftarkan lebih dari satu anak. Tryout-nya sendiri bisa dikerjakan lewat HP maupun komputer.",
  },
  {
    q: "Bagaimana skema pembayaran untuk sekolah?",
    a: "Sekolah membayar lewat transfer manual dan invoice resmi, bukan potongan otomatis. Setelah dana dikonfirmasi, tim kami mengaktifkan kuota kursi untuk sekolah Anda.",
  },
  {
    q: "Kalau daftar lewat bimbel/mitra, apakah data siswa dibagikan ke mereka?",
    a: "Tidak untuk identitasnya. Mitra hanya bisa melihat berapa kode yang sudah terpakai dari kuota mereka — bukan NISN atau nama lengkap siswa yang memakainya.",
  },
  {
    q: "Kalau langganan habis, riwayat hasilnya hilang?",
    a: "Tidak. Riwayat nilai dan pembahasan tetap bisa dibuka kapan saja, bahkan setelah masa langganan berakhir — yang berhenti hanya akses untuk memulai tryout baru.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 mx-auto max-w-3xl px-6 py-20 sm:py-24">
      <Reveal>
        <h2 className="text-3xl font-bold text-balance text-slate-900">Pertanyaan umum</h2>
      </Reveal>
      <div className="mt-8 flex flex-col">
        {FAQ.map((item, i) => (
          <Reveal key={item.q} delay={Math.min(i * 40, 200)}>
            <details className="group border-b border-slate-200 py-4" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="shrink-0 font-mono text-lg text-indigo-600 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
