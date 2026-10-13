import { NextResponse } from "next/server";
import { z } from "zod";
import { buatExcelPaket, namaBerkasLaporan } from "@/lib/hasil-tryout/excel";
import { namaSekolah, teksSyarat } from "@/lib/hasil-tryout/laporan";
import { muatHasilSekolah, muatPaketLaporan, muatSedangMengerjakan, muatSiswaAktifJenjang } from "@/lib/hasil-tryout/muat";
import { bacaAksesLaporan, bacaFilterLaporan, kePenyaring } from "@/lib/hasil-tryout/param";
import { saringHasil, susunDetailPaket } from "@/lib/hasil-tryout/susun";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

/** Unduh performa satu paket (peringkat dan yang belum mengerjakan) sebagai Excel, syarat sama dengan layar. */
export async function GET(request: Request, { params }: RouteParams) {
  const akses = await bacaAksesLaporan(request, { kunci: "hasil-tryout-unduh", batasPerMenit: 20 });
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

  const [semuaPaket, siswaAktif, sedang, sekolah] = await Promise.all([
    muatHasilSekolah(akses.schoolId, { paketId: id }),
    muatSiswaAktifJenjang(akses.schoolId, paket.jenjang),
    muatSedangMengerjakan(akses.schoolId, id),
    namaSekolah(akses.schoolId),
  ]);
  const filter = { ...f.filter, paketId: null, mapelId: null, cari: null };
  const hasilPaket = saringHasil(semuaPaket, kePenyaring(filter));
  const detail = susunDetailPaket({ hasilPaket, siswaAktif, sedangMengerjakan: sedang });

  const sekarang = new Date();
  const berkas = await buatExcelPaket(
    { sekolah, paket: paket.nama, mapel: paket.mapel, filter: teksSyarat(filter, semuaPaket), dibuatPada: sekarang },
    detail.statistik,
    detail.hasil,
    detail.belum,
  );

  return new NextResponse(new Uint8Array(berkas), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkasLaporan("performa-paket", paket.nama, sekarang, "xlsx")}"`,
      "Cache-Control": "no-store",
    },
  });
}
