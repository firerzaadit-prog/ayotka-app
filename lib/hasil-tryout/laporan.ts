import "server-only";
import { prisma } from "@/lib/db/prisma";
import { deskripsiFilter } from "@/lib/hasil-tryout/format";
import { LABEL_FILTER_JENIS } from "@/lib/hasil-tryout/jenis";
import { muatHasilSekolah } from "@/lib/hasil-tryout/muat";
import { kePenyaring, type FilterLaporan } from "@/lib/hasil-tryout/param";
import { daftarPilihan, saringHasil, susunPeringkatSiswa, type BarisPeringkatSiswa, type HasilTryOut } from "@/lib/hasil-tryout/susun";
import { formatWIBDate } from "@/lib/utils/datetime";

/** Peringkat siswa sekolah menurut filter: dipakai rute JSON dan berkas unduhan supaya angkanya selalu sama. */
export async function bangunPeringkat(
  schoolId: string,
  filter: FilterLaporan,
  minimalTryOut: number,
): Promise<{ semua: HasilTryOut[]; terpilih: HasilTryOut[]; baris: BarisPeringkatSiswa[] }> {
  const semua = await muatHasilSekolah(schoolId);
  const terpilih = saringHasil(semua, kePenyaring(filter));
  return { semua, terpilih, baris: susunPeringkatSiswa(terpilih, minimalTryOut) };
}

/** "yyyy-MM-dd" (WIB) -> "13 Oktober 2026" untuk keterangan syarat. */
const tanggalTeks = (d: Date | null) => (d ? formatWIBDate(d) : null);

/** Syarat yang aktif sebagai teks (judul berkas dan lembar ringkasan). */
export function teksSyarat(filter: FilterLaporan, semua: HasilTryOut[], opsi: { minimalTryOut?: number } = {}): string[] {
  const pilihan = daftarPilihan(semua);
  return deskripsiFilter({
    jenisLabel: filter.jenis === "semua" ? null : LABEL_FILTER_JENIS[filter.jenis],
    mapelNama: filter.mapelId ? (pilihan.mapel.find((m) => m.id === filter.mapelId)?.nama ?? null) : null,
    paketNama: filter.paketId ? (pilihan.paket.find((p) => p.id === filter.paketId)?.nama ?? null) : null,
    dariTeks: tanggalTeks(filter.dari),
    sampaiTeks: tanggalTeks(filter.sampai),
    tanpaAlumni: filter.alumni === "tanpa",
    minimalTryOut: opsi.minimalTryOut,
  });
}

export async function namaSekolah(schoolId: string): Promise<string> {
  const s = await prisma.school.findUnique({ where: { id: schoolId }, select: { nama: true } });
  return s?.nama ?? "Sekolah";
}

