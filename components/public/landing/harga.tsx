import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { Tilt3DCard } from "@/components/ui/animated-3d-card";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";

const CEK = (
  <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SPARKLE = (
  <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true">
    <path
      d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"
      fill="currentColor"
    />
  </svg>
);

function ListFitur({
  items,
  highlightIndexes = [],
  className,
}: {
  items: string[];
  highlightIndexes?: number[];
  className?: string;
}) {
  return (
    <ul className="mt-5 flex flex-1 flex-col gap-2.5">
      {items.map((item, idx) => {
        const isHighlight = highlightIndexes.includes(idx);
        return (
          <li
            key={item}
            className={`flex items-start gap-2.5 text-sm ${
              isHighlight ? "font-semibold text-white" : className ?? "text-slate-600"
            }`}
          >
            {isHighlight ? SPARKLE : CEK}
            <span>{item}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Harga() {
  const whatsappSekolah = buildWhatsAppLink(
    "Halo, saya tertarik dengan paket AyoTKA untuk sekolah kami.",
  );

  return (
    <section id="harga" className="scroll-mt-24 bg-slate-50/70 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Pilihan Paket &amp; Investasi Belajar
          </p>
          <h2 className="mt-2 text-3xl font-bold text-balance text-slate-900 sm:text-4xl">
            Struktur Belajar Cerdas Didukung AI Learning Analytics
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Mulai eksplorasi secara gratis. Pilih paket Bulanan atau Semester untuk akses latihan tanpa batas,
            evaluasi prediktif berbasis AI, dan agenda Try Out Nasional resmi.
          </p>
        </Reveal>

        {/* Grid 4 Kartu Utama */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Free Trial */}
          <Reveal className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-slate-300">
              <span className="font-mono text-xs uppercase tracking-wide text-slate-400">Coba Dulu</span>
              <p className="mt-1.5 text-3xl font-extrabold text-slate-900">Rp0</p>
              <span className="text-xs text-slate-500">gratis tanpa batas waktu</span>
              <ListFitur
                items={[
                  "1x Try Out per mata pelajaran",
                  "Skor akhir & peta capaian materi",
                  "Pembahasan soal dasar",
                  "Akses materi simulasi SD & SMP",
                ]}
              />
              <Link
                href="/registrasi"
                className="mt-6 rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Mulai Gratis
              </Link>
            </div>
          </Reveal>

          {/* 2. Bulanan */}
          <Reveal delay={80} className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/50 via-white to-white p-6 shadow-sm transition-all hover:border-indigo-300">
              <span className="w-fit rounded-full bg-indigo-100 px-2.5 py-0.5 font-mono text-[0.65rem] font-bold text-indigo-700">
                Paling Fleksibel
              </span>
              <span className="mt-2 font-mono text-xs uppercase tracking-wide text-slate-500">Paket Bulanan</span>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">
                Rp39.000<span className="text-xs font-normal text-slate-500"> /30 hari</span>
              </p>
              <span className="text-xs text-slate-500">berhenti kapan saja</span>
              <ListFitur
                highlightIndexes={[1]}
                items={[
                  "Try Out Mandiri sepuasnya semua mapel",
                  "Plus 1x Learning Analytics AI per mapel",
                  "Peta kompetensi lengkap tiap pengerjaan",
                  "Grafik perkembangan & riwayat nilai",
                  "Analisis kelemahan topik belajar AI",
                ]}
              />
              <Link
                href="/registrasi"
                className="mt-6 rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-700 shadow-sm shadow-indigo-600/25"
              >
                Pilih Paket Bulanan
              </Link>
            </div>
          </Reveal>

          {/* 3. Semester (Hero Card) */}
          <Reveal delay={160} className="h-full">
            <Tilt3DCard gradient="from-violet-600 via-indigo-700 to-indigo-950" className="p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-amber-400/90 px-2.5 py-0.5 font-mono text-[0.68rem] font-extrabold text-indigo-950">
                  REKOMENDASI TERBAIK
                </span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[0.62rem] font-bold text-white">
                  HEMAT 36%
                </span>
              </div>
              <span className="mt-3 font-mono text-xs uppercase tracking-wide text-white/80">Paket Semester</span>
              <p className="mt-1 text-3xl font-extrabold text-white">
                Rp149.000<span className="text-xs font-medium text-white/75"> /180 hari</span>
              </p>
              <span className="text-xs text-white/75">setara &plusmn;Rp24.800/bulan</span>
              <ListFitur
                className="text-white/90"
                highlightIndexes={[0, 1, 2]}
                items={[
                  "Mendapatkan Try Out Nasional 3 kali per mapel",
                  "Plus Analisis AI Learning Analytics lengkap",
                  "Try Out Mandiri tanpa batas semua mapel",
                  "Laporan bulanan berkala untuk orang tua",
                  "Simulasi penuh terstandar jelang hari-H",
                  "Rekomendasi adaptif penguasaan materi",
                ]}
              />
              <Link
                href="/registrasi"
                className="mt-6 rounded-xl bg-white px-4 py-2.5 text-center text-sm font-bold text-indigo-900 transition-colors hover:bg-white/95 shadow-md"
              >
                Ambil Paket Semester
              </Link>
            </Tilt3DCard>
          </Reveal>

          {/* 4. Sekolah & Institusi */}
          <Reveal delay={240} className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-slate-300">
              <span className="font-mono text-xs uppercase tracking-wide text-slate-400">Sekolah &amp; Lembaga</span>
              <p className="mt-1.5 text-2xl font-extrabold text-slate-900">
                Rp20–30rb<span className="text-xs font-medium text-slate-400"> /siswa/bln</span>
              </p>
              <span className="text-xs text-slate-500">harga grosir berjenjang per siswa</span>
              <ListFitur
                items={[
                  "Semua akses fitur siswa sekolah",
                  "Dashboard & rekap analitik nilai kelas",
                  "Manajemen rombel mandiri guru",
                  "Laporan kesiapan TKA sekolah",
                ]}
              />
              <a
                href={whatsappSekolah}
                target="_blank"
                rel="noreferrer"
                className="mt-6 rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Konsultasi Sekolah
              </a>
            </div>
          </Reveal>
        </div>

        {/* Section Kemitraan / Reseller (Baru Sesuai Permintaan Klien) */}
        <Reveal delay={300} className="mt-8">
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 p-6 text-white shadow-md sm:flex-row sm:p-8">
            <div className="flex flex-col gap-2 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-extrabold text-indigo-950 uppercase">
                  Program Mitra &amp; Reseller
                </span>
                <span className="text-xs text-indigo-200 font-medium">Beli Grosir Mandiri</span>
              </div>
              <h3 className="text-xl font-bold text-white sm:text-2xl">
                Daftar Sebagai Mitra AyoTKA &amp; Dapatkan Diskon Hingga 30%
              </h3>
              <p className="text-sm text-indigo-100/90 leading-relaxed">
                Mendaftar langsung secara mandiri tanpa antre persetujuan admin. Beli voucher Paket Bulanan atau Semester
                dalam jumlah banyak (2–9 siswa: diskon 20%, 10–49 siswa: diskon 25%, &ge;50 siswa: diskon 30%), lalu bagikan
                kode akses langsung kepada siswamu.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2.5 sm:items-end">
              <Link
                href="/registrasi/mitra"
                className="inline-flex items-center justify-center rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-indigo-950 transition-all hover:bg-amber-300 shadow-md hover:scale-105"
              >
                Daftar Jadi Mitra Sekarang →
              </Link>
              <Link
                href="/login"
                className="text-center text-xs text-indigo-200 hover:text-white"
              >
                Sudah punya akun mitra? Masuk di sini
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
