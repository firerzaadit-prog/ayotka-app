import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonClassName } from "@/components/ui/button";

/**
 * Rincian Biaya AyoTKA (keputusan produk): free trial tidak pernah memicu
 * panggilan Gemini sama sekali (lihat lib/ai/auto-trigger.ts) - blok ini
 * teks statis placeholder yang diblur, BUKAN hasil AI sungguhan. Nol biaya
 * AI untuk siapa pun yang belum berlangganan, berapa pun jumlahnya.
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
          Berlangganan untuk membuka analisis kelebihan, kekurangan, dan rekomendasi belajar dari AI
          untuk hasil ini.
        </p>
        <Link href="/siswa/langganan" className={buttonClassName("primary")}>
          Berlangganan untuk lihat analisis lengkap
        </Link>
      </div>
    </Card>
  );
}
