"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button, buttonClassName } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { OpsiLaSusulan } from "@/lib/billing/learning-analytics";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

type Tersedia = Extract<OpsiLaSusulan, { tersedia: true }>;

/**
 * Kartu "Lakukan Learning Analytics" di halaman hasil siswa: untuk percobaan yang tidak mengaktifkan Learning
 * Analytics saat ujian dimulai. Empat keadaan: jatah paket tersedia, batas tercapai, saldo cukup (dengan
 * konfirmasi karena memotong saldo), saldo kurang (diarahkan mengisi saldo). Semua angka datang dari server
 * (lib/billing/la-susulan.ts) dan diperiksa ulang server saat tombol ditekan - kartu ini hanya menampilkan.
 */
export function LaSusulanCard({
  attemptId,
  opsi,
  catatan,
  onMulai,
  onSegarkan,
}: {
  attemptId: string;
  opsi: Tersedia;
  /** Pesan dari percobaan sebelumnya yang belum berhasil (mis. analisis gagal dan saldo dikembalikan). */
  catatan?: string | null;
  /** Dipanggil setelah server menerima permintaan: halaman beralih ke panel hasil/proses. */
  onMulai: () => void;
  /** Minta halaman memuat ulang opsi (saldo atau jatah berubah di server). */
  onSegarkan: () => void;
}) {
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function jalankan() {
    setGalat(null);
    setMengirim(true);
    try {
      const res = await fetch(`/api/siswa/attempts/${attemptId}/learning-analytics`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setGalat(json?.error ?? "Gagal memulai Learning Analytics. Coba lagi sebentar lagi.");
        setKonfirmasi(false);
        // saldo/jatah di server bisa sudah berubah (mis. dipakai di tab lain): tampilkan angka terbaru
        onSegarkan();
        return;
      }
      onMulai();
    } catch {
      setGalat("Koneksi bermasalah. Coba lagi.");
    } finally {
      setMengirim(false);
    }
  }

  const kembali = encodeURIComponent(`/siswa/hasil/${attemptId}`);

  return (
    <Card className="relative overflow-hidden">
      {/* Cuplikan buram sebagai gambaran isi analisis - teks contoh statis, BUKAN hasil AI sungguhan. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none overflow-hidden p-5 blur-sm">
        <p className="text-sm font-semibold text-slate-900">Kelebihan & Kekurangan</p>
        <p className="mt-1 text-sm text-slate-600">
          Siswa cukup kuat di materi Bilangan dan Pengukuran, namun masih perlu banyak latihan pada materi Geometri
          terutama soal cerita bangun ruang.
        </p>
        <p className="mt-3 text-sm font-semibold text-slate-900">Rekomendasi Belajar</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Latihan soal cerita bangun ruang dengan variasi konteks</li>
          <li>Ulangi materi Aljabar & Pola sebelum lanjut ke bab berikutnya</li>
        </ul>
      </div>

      {/* Isi berada di alur normal (kartu ikut tumbuh mengikuti isinya); cuplikan buram hanya latar. */}
      <div className="relative flex min-h-[14rem] flex-col items-center justify-center gap-3 rounded-lg bg-white/80 p-4 text-center">
        <p className="text-sm font-semibold text-slate-900">Learning Analytics</p>
        {catatan && (
          <Alert variant="warning" className="max-w-sm text-left">
            {catatan}
          </Alert>
        )}
        {galat && (
          <Alert variant="danger" className="max-w-sm text-left">
            {galat}
          </Alert>
        )}

        {opsi.pendanaan === "kuota" && opsi.batasTercapai && (
          <p className="max-w-sm text-sm text-slate-700">
            Batas Learning Analytics untuk mata pelajaran ini sudah tercapai ({opsi.batasMaks} kali). Nilai dan
            pembahasan tetap bisa kamu lihat di bawah.
          </p>
        )}

        {opsi.pendanaan === "kuota" && !opsi.batasTercapai && (
          <>
            <p className="max-w-sm text-sm text-slate-700">
              Learning Analytics tidak kamu aktifkan saat ujian, tapi kamu masih punya jatah untuk mata pelajaran ini
              {opsi.kuotaSisa != null ? ` (sisa ${opsi.kuotaSisa})` : ""}. Jalankan sekarang untuk melihat kelebihan,
              kekurangan, dan rekomendasi belajar dari AI.
            </p>
            <Button onClick={jalankan} disabled={mengirim}>
              {mengirim ? "Memulai..." : "Lakukan Learning Analytics"}
            </Button>
          </>
        )}

        {opsi.pendanaan === "saldo" && opsi.cukup && !konfirmasi && (
          <>
            <p className="max-w-sm text-sm text-slate-700">
              Dapatkan analisis AI tentang kelebihan, kekurangan, dan rekomendasi belajarmu dari ujian ini. Biayanya{" "}
              <b>{formatRupiah(opsi.harga)}</b> dari saldomu ({formatRupiah(opsi.saldo)}).
            </p>
            <Button onClick={() => setKonfirmasi(true)}>Lakukan Learning Analytics</Button>
          </>
        )}

        {opsi.pendanaan === "saldo" && opsi.cukup && konfirmasi && (
          <>
            <p className="max-w-sm text-sm text-slate-700">
              Potong <b>{formatRupiah(opsi.harga)}</b> dari saldo {formatRupiah(opsi.saldo)}? Sisa saldomu menjadi{" "}
              {formatRupiah(opsi.saldo - opsi.harga)}. Kalau analisisnya gagal diproses, saldo dikembalikan otomatis.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={jalankan} disabled={mengirim}>
                {mengirim ? "Memproses..." : "Ya, lakukan"}
              </Button>
              <Button variant="secondary" onClick={() => setKonfirmasi(false)} disabled={mengirim}>
                Batal
              </Button>
            </div>
          </>
        )}

        {opsi.pendanaan === "saldo" && !opsi.cukup && (
          <>
            <p className="max-w-sm text-sm text-slate-700">
              Learning Analytics untuk ujian ini <b>{formatRupiah(opsi.harga)}</b>. Saldo kamu {formatRupiah(opsi.saldo)}
              , kurang <b>{formatRupiah(opsi.kurang)}</b>. Isi saldo dulu; setelah saldo masuk, kembali ke halaman ini
              untuk menjalankannya.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href={`/siswa/wallet?kembali=${kembali}`} className={buttonClassName("primary")}>
                Isi saldo
              </Link>
              <Link href="/siswa/langganan" className={buttonClassName("secondary")}>
                Berlangganan
              </Link>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
