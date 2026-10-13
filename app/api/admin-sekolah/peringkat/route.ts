import { NextResponse } from "next/server";
import { URUTAN_JENIS } from "@/lib/hasil-tryout/jenis";
import { bangunPeringkat } from "@/lib/hasil-tryout/laporan";
import { bacaAksesLaporan, bacaFilterLaporan, bacaMinimalTryOut, kePenyaring } from "@/lib/hasil-tryout/param";
import { daftarPilihan, ringkasHasil, saringHasil, susunPeringkatSiswa } from "@/lib/hasil-tryout/susun";
import { keBarisPeringkat } from "@/lib/hasil-tryout/tampil";

export const dynamic = "force-dynamic";

/**
 * Peringkat siswa sekolah secara keseluruhan: rata-rata nilai hasil resmi semua try out yang dikerjakan, dari tertinggi ke
 * terendah. Parameter: jenis, mapel, paket, dari, sampai, alumni (ikut|tanpa, BAWAAN tanpa: peringkat siswa yang masih
 * aktif), minimal (jumlah try out minimal yang sudah dikerjakan, bawaan 1).
 * `jumlahSiswaPerJenis` menghitung semua syarat KECUALI jenis. `ringkasan.rataRata` = rata-rata SEMUA hasil try out milik
 * siswa yang diperingkat (tiap hasil dihitung satu kali).
 */
export async function GET(request: Request) {
  const akses = await bacaAksesLaporan(request, { kunci: "hasil-tryout", batasPerMenit: 90 });
  if ("galat" in akses) return akses.galat;

  const f = bacaFilterLaporan(akses.url, "tanpa");
  if ("galat" in f) return f.galat;
  const minimal = bacaMinimalTryOut(akses.url);
  if ("galat" in minimal) return minimal.galat;

  const { semua, terpilih, baris } = await bangunPeringkat(akses.schoolId, f.filter, minimal.nilai);
  const penyaring = kePenyaring(f.filter);

  const tanpaJenis = saringHasil(semua, { ...penyaring, jenis: "semua" });
  const jumlahSiswaPerJenis = {
    semua: susunPeringkatSiswa(tanpaJenis, minimal.nilai).length,
    ...Object.fromEntries(URUTAN_JENIS.map((j) => [j, susunPeringkatSiswa(tanpaJenis.filter((h) => h.jenis === j), minimal.nilai).length])),
  };

  const diperingkat = new Set(baris.map((b) => b.studentId));
  const hasilDiperingkat = ringkasHasil(terpilih.filter((h) => diperingkat.has(h.studentId)));
  return NextResponse.json(
    {
      baris: baris.map(keBarisPeringkat),
      ringkasan: { jumlahSiswa: baris.length, jumlahTryOut: baris.reduce((s, b) => s + b.jumlahTryOut, 0), rataRata: hasilDiperingkat.rataRata },
      jumlahSiswaPerJenis,
      pilihan: { mapel: daftarPilihan(semua).mapel },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
