import { NextResponse } from "next/server";
import { muatHasilSekolah } from "@/lib/hasil-tryout/muat";
import { bacaAksesLaporan, bacaFilterLaporan, bacaHalaman, bacaUrutanRapor, kePenyaring } from "@/lib/hasil-tryout/param";
import { ambilHalaman, daftarPilihan, hitungPerJenis, ringkasHasil, saringHasil, urutkanHasil } from "@/lib/hasil-tryout/susun";
import { keBarisRapor } from "@/lib/hasil-tryout/tampil";

export const dynamic = "force-dynamic";

/**
 * Daftar rapor siswa untuk admin sekolah: hasil resmi (percobaan pertama) tiap siswa pada tiap try out, dipisah per jenis
 * (Mandiri, Sekolah, Nasional). Tiap baris punya attemptId yang dipakai tombol unduh PDF
 * (/api/siswa/attempts/{attemptId}/rapor, yang sudah membatasi admin sekolah ke siswa sekolahnya).
 *
 * Parameter: jenis, mapel, paket, dari, sampai, alumni (ikut|tanpa, bawaan ikut), cari (nama atau NISN), urut, halaman, ukuran.
 * `jumlahPerJenis` menghitung semua syarat KECUALI jenis, supaya angka di pilihan jenis tetap bermakna.
 */
export async function GET(request: Request) {
  const akses = await bacaAksesLaporan(request, { kunci: "hasil-tryout", batasPerMenit: 90 });
  if ("galat" in akses) return akses.galat;

  const f = bacaFilterLaporan(akses.url, "ikut");
  if ("galat" in f) return f.galat;
  const hal = bacaHalaman(akses.url);
  if ("galat" in hal) return hal.galat;
  const urut = bacaUrutanRapor(akses.url);
  if ("galat" in urut) return urut.galat;

  const semua = await muatHasilSekolah(akses.schoolId);
  const penyaring = kePenyaring(f.filter);
  const tanpaJenis = saringHasil(semua, { ...penyaring, jenis: "semua" });
  const terpilih = f.filter.jenis === "semua" ? tanpaJenis : tanpaJenis.filter((h) => h.jenis === f.filter.jenis);
  const halaman = ambilHalaman(urutkanHasil(terpilih, urut.nilai), hal.halaman, hal.ukuran);

  return NextResponse.json(
    {
      baris: halaman.baris.map(keBarisRapor),
      halaman: halaman.halaman,
      ukuran: halaman.ukuran,
      total: halaman.total,
      totalHalaman: halaman.totalHalaman,
      jumlahPerJenis: hitungPerJenis(tanpaJenis),
      ringkasan: ringkasHasil(terpilih),
      pilihan: daftarPilihan(semua),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
