import { NextResponse } from "next/server";
import { z } from "zod";
import { hitungPerJenis, saringHasil, susunDetailPaket } from "@/lib/hasil-tryout/susun";
import { muatHasilSekolah, muatPaketLaporan, muatSedangMengerjakan, muatSiswaAktifJenjang } from "@/lib/hasil-tryout/muat";
import { bacaAksesLaporan, bacaFilterLaporan, kePenyaring } from "@/lib/hasil-tryout/param";
import { keBarisHasilPaket } from "@/lib/hasil-tryout/tampil";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Performa satu paket untuk sekolah ini: siapa yang sudah mengerjakan (diperingkat dari nilai tertinggi), siapa yang belum
 * (siswa aktif sejenjang tanpa hasil; yang sedang mengerjakan ditandai), serta statistiknya. Parameter: jenis (menyaring hasil;
 * "belum" = siswa aktif yang belum punya hasil pada jenis itu), dari, sampai, alumni (ikut|tanpa, bawaan ikut).
 * Paket yang tidak ada atau tidak boleh dilihat sekolah ini -> 404.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const akses = await bacaAksesLaporan(request, { kunci: "hasil-tryout", batasPerMenit: 90 });
  if ("galat" in akses) return akses.galat;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Paket tidak valid." }, { status: 400 });
  }
  const f = bacaFilterLaporan(akses.url, "ikut");
  if ("galat" in f) return f.galat;

  const paket = await muatPaketLaporan(akses.schoolId, id);
  if (!paket) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const [semuaPaket, siswaAktif, sedang] = await Promise.all([
    muatHasilSekolah(akses.schoolId, { paketId: id }),
    muatSiswaAktifJenjang(akses.schoolId, paket.jenjang),
    muatSedangMengerjakan(akses.schoolId, id),
  ]);

  // Paket ini sudah ditentukan lewat alamat; mapel dan pencarian tidak dipakai di sini.
  const penyaring = { ...kePenyaring(f.filter), paketId: null, mapelId: null, cari: null };
  const hasilPaket = saringHasil(semuaPaket, penyaring);
  const detail = susunDetailPaket({ hasilPaket, siswaAktif, sedangMengerjakan: sedang });
  const jumlahPerJenis = hitungPerJenis(saringHasil(semuaPaket, { ...penyaring, jenis: "semua" }));

  return NextResponse.json(
    {
      paket: { id: paket.id, nama: paket.nama, mapel: paket.mapel, jenjang: paket.jenjang, jumlahSoal: paket.jumlahSoal, durasiMenit: paket.durasiMenit },
      statistik: detail.statistik,
      hasil: detail.hasil.map(keBarisHasilPaket),
      belum: detail.belum,
      jumlahPerJenis,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
