import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import { Tilt3DCard } from "@/components/ui/animated-3d-card";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";
import {
  Check,
  X,
  Sparkles,
  Award,
  Bot,
  GraduationCap,
  Building2,
  Users,
  ArrowRight,
} from "lucide-react";

export function Harga() {
  const whatsappSekolah = buildWhatsAppLink(
    "Halo, saya perwakilan sekolah dan tertarik dengan paket kerja sama AyoTKA untuk sekolah kami.",
  );

  return (
    <section id="harga" className="scroll-mt-24 bg-gradient-to-b from-slate-50 via-white to-slate-50/80 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        {/* Header Section */}
        <Reveal className="mx-auto mb-14 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/80 px-3.5 py-1 text-xs font-semibold text-indigo-700 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>PILIHAN PAKET &amp; INVESTASI BELAJAR TKA</span>
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance text-slate-900 sm:text-4xl">
            Struktur Belajar Cerdas Didukung AI Learning Analytics
          </h2>
          <p className="mt-3.5 text-base leading-relaxed text-slate-600">
            Mulai eksplorasi secara gratis, pilih paket mandiri (<strong>Paket Bulanan</strong> atau <strong>Paket Semester</strong>),
            atau bermitra melalui <strong>Paket Kerja Sama Sekolah</strong> untuk seluruh angkatan.
          </p>
        </Reveal>

        {/* GRID 4 KARTU PAKET LENGKAP: GRATIS, BULANAN, SEMESTER, SEKOLAH */}
        <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. PAKET COBA GRATIS */}
          <Reveal className="h-full">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-slate-300 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                    COBA DULU
                  </span>
                  <span className="font-mono text-[0.68rem] text-slate-400">Gratis</span>
                </div>

                <h3 className="mt-2 text-xl font-extrabold text-slate-900">Coba Gratis</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Eksplorasi awal format soal TKA SD &amp; SMP untuk mengenal tipe asesmen.
                </p>

                <div className="mt-4 border-y border-slate-100 py-3">
                  <p className="text-3xl font-extrabold text-slate-900">Rp0</p>
                  <span className="text-xs text-slate-400">tanpa batas waktu &amp; tanpa kartu</span>
                </div>

                <ul className="mt-5 flex flex-col gap-2.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span>1x Try Out per mata pelajaran (SD &amp; SMP)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span>Skor akhir &amp; peta capaian materi dasar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span>Pembahasan soal dasar tiap latihan</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span>Simulasi pengenalan sistem ujian digital</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/registrasi"
                className="mt-6 rounded-xl border border-slate-300 px-4 py-2.5 text-center text-xs font-bold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Mulai Gratis
              </Link>
            </div>
          </Reveal>

          {/* 2. PAKET BULANAN */}
          <Reveal delay={80} className="h-full">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/40 via-white to-white p-6 shadow-sm transition-all hover:border-indigo-300 hover:shadow-lg">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 font-mono text-[0.65rem] font-bold text-indigo-700">
                    AKSES FLEKSIBEL
                  </span>
                  <span className="font-mono text-[0.68rem] text-slate-500">30 Hari</span>
                </div>

                <h3 className="mt-2 text-xl font-extrabold text-slate-900">Paket Bulanan</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Latihan mandiri rutin tanpa batas. Berhenti atau perpanjang kapan saja.
                </p>

                <div className="mt-4 border-y border-slate-100 py-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">Rp39.000</span>
                    <span className="text-xs text-slate-500">/ 30 hari</span>
                  </div>
                  <span className="text-xs text-slate-400">pembayaran online sekali bayar</span>
                </div>

                <ul className="mt-5 flex flex-col gap-2.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2 font-medium text-slate-900">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span><strong>Try Out Mandiri sepuasnya</strong> semua mapel</span>
                  </li>
                  <li className="flex items-start gap-2 font-medium text-slate-900">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span><strong>Akses skor &amp; peta kompetensi</strong> sepuasnya</span>
                  </li>
                  <li className="flex items-start gap-2 font-medium text-indigo-950">
                    <Bot className="h-4 w-4 shrink-0 text-indigo-600 font-bold" />
                    <span><strong>Plus 1x Learning Analytics AI</strong> per mapel</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-400">
                    <X className="h-4 w-4 shrink-0 text-slate-400 font-bold" />
                    <span className="line-through">Tidak termasuk Try Out Nasional</span>
                  </li>
                </ul>

                <p className="mt-3 text-[0.7rem] text-slate-500 italic">
                  * Top-up saldo dompet kapan saja jika butuh analisis AI mandiri ekstra.
                </p>
              </div>

              <Link
                href="/registrasi"
                className="mt-6 rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-xs font-bold text-white shadow-sm shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-md"
              >
                Pilih Paket Bulanan
              </Link>
            </div>
          </Reveal>

          {/* 3. PAKET SEMESTER (HERO REKOMENDASI) */}
          <Reveal delay={160} className="h-full">
            <Tilt3DCard
              gradient="from-indigo-950 via-indigo-900 to-violet-950"
              className="flex h-full flex-col justify-between p-6 text-white shadow-xl shadow-indigo-950/30 ring-2 ring-amber-400"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 font-mono text-[0.65rem] font-extrabold text-indigo-950">
                    <Sparkles className="h-2.5 w-2.5 fill-indigo-950" />
                    REKOMENDASI TERBAIK
                  </span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[0.62rem] font-bold text-white">
                    HEMAT 36%
                  </span>
                </div>

                <h3 className="mt-2 text-xl font-extrabold text-white">Paket Semester</h3>
                <p className="mt-1 text-xs text-indigo-100/80">
                  Persiapan komprehensif dengan simulasi nasional resmi &amp; evaluasi AI penuh.
                </p>

                <div className="mt-4 border-y border-white/15 py-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-white">Rp149.000</span>
                    <span className="text-xs text-white/70">/ 180 hari</span>
                  </div>
                  <span className="text-xs text-amber-300 font-semibold">setara ±Rp24.800/bulan (6 bulan)</span>
                </div>

                <ul className="mt-5 flex flex-col gap-2.5 text-xs text-indigo-100">
                  <li className="flex items-start gap-2 text-white">
                    <Award className="h-4 w-4 shrink-0 text-amber-300 font-bold" />
                    <span>
                      <strong className="text-amber-300">Mendapatkan Try Out Nasional 3 kali</strong> per mata pelajaran
                    </span>
                  </li>
                  <li className="flex items-start gap-2 text-white">
                    <Bot className="h-4 w-4 shrink-0 text-amber-300 font-bold" />
                    <span>
                      <strong className="text-amber-300">Plus Learning Analytics AI lengkap</strong> di setiap sesi TO Nasional
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-white font-bold" />
                    <span><strong>Try Out Mandiri tanpa batas</strong> semua mapel</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-white font-bold" />
                    <span><strong>Akses skor &amp; peta kompetensi</strong> sepuasnya</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-amber-300 font-bold" />
                    <span><strong>Plus 1x Learning Analytics AI</strong> per mapel (TO Mandiri)</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/registrasi"
                className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-center text-xs font-extrabold text-indigo-950 shadow-md shadow-amber-400/25 transition-all hover:bg-amber-300 hover:scale-[1.02]"
              >
                <span>Ambil Paket Semester</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Tilt3DCard>
          </Reveal>

          {/* 4. PAKET KERJA SAMA SEKOLAH & LEMBAGA */}
          <Reveal delay={240} className="h-full">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-slate-300 hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                    KERJA SAMA SEKOLAH
                  </span>
                  <span className="font-mono text-[0.68rem] text-indigo-600 font-semibold">Institusi</span>
                </div>

                <h3 className="mt-2 text-xl font-extrabold text-slate-900">Sekolah &amp; Lembaga</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Daftarkan seluruh siswa satu angkatan atau per rombel/kelas sekolah.
                </p>

                <div className="mt-4 border-y border-slate-100 py-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-slate-900">Rp100–140rb</span>
                    <span className="text-xs text-slate-500">/ siswa</span>
                  </div>
                  <span className="text-xs text-emerald-600 font-semibold">fasilitas setara paket semester</span>
                </div>

                <ul className="mt-5 flex flex-col gap-2.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2 font-medium text-slate-900">
                    <Award className="h-4 w-4 shrink-0 text-amber-500 font-bold" />
                    <span><strong>Fasilitas setara Paket Semester</strong> per siswa</span>
                  </li>
                  <li className="flex items-start gap-2 font-medium text-slate-900">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span><strong>3x Try Out Nasional</strong> per mapel + Analisis AI</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span><strong>Try Out Mandiri sepuasnya</strong> + 1x AI per mapel</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-indigo-600 font-bold" />
                    <span>Dashboard &amp; rekap analitik nilai kelas guru</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span>Manajemen akun siswa &amp; kuota dari Admin Pusat</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 font-bold" />
                    <span>Tagihan lewat invoice resmi — bisa Dana BOS</span>
                  </li>
                </ul>
              </div>

              <a
                href={whatsappSekolah}
                target="_blank"
                rel="noreferrer"
                className="mt-6 rounded-xl border border-slate-300 px-4 py-2.5 text-center text-xs font-bold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                Konsultasi Sekolah
              </a>
            </div>
          </Reveal>
        </div>

        {/* TABEL PERBANDINGAN FITUR (SIDE BY SIDE MATRIX) */}
        <Reveal delay={280} className="mt-14">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h4 className="text-base font-bold text-slate-900">Perbandingan Fasilitas Paket Siswa</h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  Rincian komparasi fasilitas antara Paket Bulanan dan Paket Semester
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                Siswa Sekolah (Rp100–140rb) mendapatkan fasilitas setara Paket Semester
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3.5">Fasilitas Belajar</th>
                    <th className="px-6 py-3.5 text-center">Paket Bulanan (Rp39.000)</th>
                    <th className="px-6 py-3.5 text-center bg-indigo-50/60 text-indigo-950 font-extrabold">
                      Paket Semester (Rp149.000) ⭐
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-6 py-3.5 font-medium text-slate-900">Try Out Mandiri (Semua Mapel)</td>
                    <td className="px-6 py-3.5 text-center text-emerald-600 font-semibold">Sepuasnya / Tanpa Batas</td>
                    <td className="px-6 py-3.5 text-center bg-indigo-50/30 text-emerald-600 font-semibold">Sepuasnya / Tanpa Batas</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3.5 font-medium text-slate-900">Akses Nilai Skor &amp; Peta Kompetensi</td>
                    <td className="px-6 py-3.5 text-center text-emerald-600 font-semibold">Sepuasnya / Tanpa Batas</td>
                    <td className="px-6 py-3.5 text-center bg-indigo-50/30 text-emerald-600 font-semibold">Sepuasnya / Tanpa Batas</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3.5 font-medium text-slate-900">Learning Analytics AI Bawaan (Mandiri)</td>
                    <td className="px-6 py-3.5 text-center text-indigo-700 font-medium">1x per Mata Pelajaran</td>
                    <td className="px-6 py-3.5 text-center bg-indigo-50/30 text-indigo-700 font-medium">1x per Mata Pelajaran</td>
                  </tr>
                  <tr className="bg-amber-50/30">
                    <td className="px-6 py-3.5 font-medium text-slate-900">
                      <span className="flex items-center gap-1.5">
                        <Award className="h-4 w-4 text-amber-600" />
                        <strong>Try Out Nasional Resmi</strong>
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center text-slate-400 font-normal">
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <X className="h-4 w-4" /> Tidak Tersedia
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center bg-amber-100/50 font-extrabold text-indigo-950">
                      <span className="inline-flex items-center gap-1 text-indigo-900 font-bold">
                        <Check className="h-4 w-4 text-emerald-600 stroke-[3]" /> 3 Kali per Mata Pelajaran
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-amber-50/30">
                    <td className="px-6 py-3.5 font-medium text-slate-900">
                      <span className="flex items-center gap-1.5">
                        <Bot className="h-4 w-4 text-indigo-600" />
                        <strong>Analisis AI di Try Out Nasional</strong>
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center text-slate-400 font-normal">—</td>
                    <td className="px-6 py-3.5 text-center bg-amber-100/50 font-bold text-indigo-900">
                      Termasuk Otomatis (Semua Sesi)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3.5 font-medium text-slate-900">Masa Aktif Akun</td>
                    <td className="px-6 py-3.5 text-center text-slate-700">30 Hari</td>
                    <td className="px-6 py-3.5 text-center bg-indigo-50/30 text-indigo-900 font-bold">180 Hari (6 Bulan)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3.5 font-medium text-slate-900">Opsi Top-up AI Tambahan via Dompet</td>
                    <td className="px-6 py-3.5 text-center text-emerald-600 font-semibold">Didukung (Kapan Saja)</td>
                    <td className="px-6 py-3.5 text-center bg-indigo-50/30 text-emerald-600 font-semibold">Didukung (Kapan Saja)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>

        {/* SECTION PROGRAM MITRA & RESELLER */}
        <Reveal delay={320} className="mt-8">
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
                href="/mitra/login"
                className="text-center text-xs font-semibold text-amber-300 hover:text-white underline"
              >
                Sudah punya akun mitra? Masuk di sini &rarr;
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
