import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";

/**
 * Rincian Biaya AyoTKA (keputusan produk): percobaan gratis tidak memicu
 * panggilan Gemini kecuali siswa sendiri menyalakan Learning Analytics
 * (dibayar saldo, lihat lib/billing/learning-analytics.ts) - blok ini
 * teks statis placeholder yang diblur, BUKAN hasil AI sungguhan. Nol biaya
 * AI untuk siapa pun yang belum membayar.
 */
export function AnalisisAiTeaser() {
  return (
    <Card className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none select-none blur-sm">
        <p className="text-sm font-semibold text-slate-900">Kelebihan & Kekurangan</p>
        <p className="mt-1 text-sm text-slate-600">
          Siswa cukup kuat di materi Bilangan dan Pengukuran, namun masih perlu banyak latihan pada
          materi Geometri terutama soal cerita bangun ruang.
        </p>
        <p className="mt-3 text-sm font-semibold text-slate-900">Rekomendasi Belajar</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Latihan soal cerita bangun ruang dengan variasi konteks</li>
          <li>Ulangi materi Aljabar & Pola sebelum lanjut ke bab berikutnya</li>
        </ul>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 p-4 text-center">
        <p className="max-w-xs text-sm font-medium text-slate-700">
          Learning Analytics tidak aktif untuk percobaan ini. Berlangganan, atau Top Up kredit lalu
          aktifkan Learning Analytics di ujian berikutnya, untuk membuka analisis kelebihan,
          kekurangan, dan rekomendasi belajar dari AI.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link href="/siswa/langganan" className={buttonClassName("primary")}>
            Berlangganan
          </Link>
          <Link href="/siswa/wallet" className={buttonClassName("secondary")}>
            Top Up kredit
          </Link>
        </div>
      </div>
    </Card>
  );
}
