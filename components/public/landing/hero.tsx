import Link from "next/link";
import { Globe, Phone } from "lucide-react";
import { KartuFrame, Perforation, ExamNumber, FieldLabel } from "@/components/public/landing/kit";

const KOMPETENSI = [
  { label: "Bilangan", nilai: 84, warna: "bg-emerald-600" },
  { label: "Aljabar & Pola", nilai: 64, warna: "bg-amber-600" },
  { label: "Geometri", nilai: 36, warna: "bg-rose-600" },
];

/**
 * Hero "Kartu Peserta Ujian" (arah desain new-work impeccable, index 7/7):
 * seluruh hero DIBANGUN sebagai satu kartu peserta ujian besar, bukan hero
 * teks+mockup terpisah seperti sebelumnya. Nomor peserta & kotak foto ikon
 * membingkai headline sebagai "judul cetak" kartu; garis perforasi di bawah
 * memisahkan kartu dari "sobekan hasil" (peta kompetensi) - realisasi
 * langsung dari FIRST VIEWPORT pada direction contract.
 */
export function Hero() {
  return (
    <section className="card-paper-texture px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <KartuFrame className="bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-card-ink/15 px-5 py-3 sm:px-8">
            <FieldLabel>Kartu Peserta &middot; Tes Kemampuan Akademik</FieldLabel>
            <ExamNumber className="text-xs sm:text-sm">No. 2026-TKA-000001</ExamNumber>
          </div>

          <div className="grid grid-cols-1 gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[auto_1fr] lg:items-start">
            <div
              className="mx-auto flex h-24 w-24 shrink-0 items-center justify-center border border-card-ink/25 bg-card-paper text-card-ink/50 lg:mx-0"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10">
                <circle cx="12" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>

            <div>
              <h1 className="font-card-serif text-3xl font-semibold leading-tight text-balance text-card-ink sm:text-4xl">
                Nilai Tes Kemampuan Akademik 68. Tapi kelebihan &amp; kelemahan materi di sebelah mana?
              </h1>
              <p className="mt-4 max-w-xl font-card text-base leading-relaxed text-card-ink/70">
                AyoTKA tidak cuma menerbitkan skor akhir. Tiap hasil tryout dipetakan per materi lewat
                sistem learning analytics, supaya jelas materi mana yang perlu dilatih lagi.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/registrasi"
                  className="border border-card-ink bg-card-ink px-6 py-3 text-center font-card text-sm font-semibold text-card-paper transition-transform hover:-translate-y-0.5"
                >
                  Daftar sebagai siswa
                </Link>
                <Link
                  href="/login"
                  className="border border-card-ink/30 bg-white px-6 py-3 text-center font-card text-sm font-semibold text-card-ink transition-colors hover:border-card-ink/60"
                >
                  Masuk ke akunmu
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 font-card-mono text-xs text-card-ink/55">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ayotka.id
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  (0341) 551312
                </div>
              </div>
            </div>
          </div>

          <Perforation />

          <div className="px-5 py-7 sm:px-8">
            <div className="flex items-baseline justify-between">
              <FieldLabel>Sobekan Hasil &middot; Peta Kompetensi</FieldLabel>
              <span className="font-card text-sm font-semibold text-card-ink">Matematika</span>
            </div>
            <p className="mt-2 font-card-serif text-4xl font-semibold text-card-ink">
              68<span className="font-card text-base font-medium text-card-ink/45">/100</span>
            </p>
            <div className="mt-5 flex flex-col gap-4">
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
            <Link
              href="/registrasi"
              className="mt-5 inline-block font-card text-sm font-semibold text-card-ink underline decoration-card-ink/30 underline-offset-4 hover:decoration-card-ink"
            >
              Lihat peta lengkap →
            </Link>
          </div>
        </KartuFrame>
      </div>
    </section>
  );
}
