import { Card } from "@/components/ui/card";

/**
 * Bagian 8/10 (permintaan user): paket Latihan tidak pernah dapat analisis
 * AI, berlaku sama untuk siswa berlangganan maupun sekolah - beda dari
 * AnalisisAiTeaser (yang punya CTA "berlangganan") karena di sini siswanya
 * bisa saja sudah berlangganan, cuma paketnya memang bukan Try Out resmi.
 */
export function LatihanAiNotice() {
  return (
    <Card className="text-center">
      <p className="text-sm font-medium text-slate-700">
        Ini paket Latihan - hasilnya hanya skor akhir dan Peta Kompetensi di atas, tanpa analisis AI.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Analisis AI lengkap tersedia untuk paket Try Out resmi.
      </p>
    </Card>
  );
}
