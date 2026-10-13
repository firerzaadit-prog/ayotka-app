import { NextResponse } from "next/server";
import { URUTAN_JENIS } from "@/lib/hasil-tryout/jenis";
import { hitungSiswaAktifPerJenjang, muatHasilSekolah } from "@/lib/hasil-tryout/muat";
import { bacaAksesLaporan, bacaFilterLaporan, bacaUrutanPaket, kePenyaring } from "@/lib/hasil-tryout/param";
import { daftarPilihan, saringHasil, susunDaftarPaket } from "@/lib/hasil-tryout/susun";
import { keBarisPaket } from "@/lib/hasil-tryout/tampil";

export const dynamic = "force-dynamic";

/**
 * Paket try out yang dikerjakan siswa sekolah ini, dari yang paling banyak dikerjakan (bisa diurutkan lain). Parameter:
 * jenis (gabungan atau satu jenis), mapel, dari, sampai, alumni (ikut|tanpa, bawaan ikut), urut.
 * `jumlahPaketPerJenis` menghitung semua syarat KECUALI jenis (paket dihitung pada tiap jenis yang pernah dikerjakan di sana).
 */
export async function GET(request: Request) {
  const akses = await bacaAksesLaporan(request, { kunci: "hasil-tryout", batasPerMenit: 90 });
  if ("galat" in akses) return akses.galat;

  const f = bacaFilterLaporan(akses.url, "ikut");
  if ("galat" in f) return f.galat;
  const urut = bacaUrutanPaket(akses.url);
  if ("galat" in urut) return urut.galat;

  const [semua, aktifPerJenjang] = await Promise.all([muatHasilSekolah(akses.schoolId), hitungSiswaAktifPerJenjang(akses.schoolId)]);
  const penyaring = kePenyaring(f.filter);
  const terpilih = saringHasil(semua, penyaring);
  const baris = susunDaftarPaket(terpilih, aktifPerJenjang, urut.nilai);

  const tanpaJenis = saringHasil(semua, { ...penyaring, jenis: "semua" });
  const banyakPaket = (hasil: typeof tanpaJenis) => new Set(hasil.map((h) => h.packageId)).size;
  const jumlahPaketPerJenis = {
    semua: banyakPaket(tanpaJenis),
    ...Object.fromEntries(URUTAN_JENIS.map((j) => [j, banyakPaket(tanpaJenis.filter((h) => h.jenis === j))])),
  };

  return NextResponse.json(
    {
      baris: baris.map(keBarisPaket),
      jumlahPaketPerJenis,
      ringkasan: {
        jumlahPaket: baris.length,
        jumlahHasil: terpilih.length,
        jumlahSiswa: new Set(terpilih.map((h) => h.studentId)).size,
      },
      pilihan: { mapel: daftarPilihan(semua).mapel },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
