import ExcelJS from "exceljs";
import { LABEL_JENIS_TRYOUT } from "@/lib/hasil-tryout/jenis";
import type { BarisBelum, BarisHasilPaket, BarisPeringkatSiswa, StatistikPaket } from "@/lib/hasil-tryout/susun";
import { formatWIB } from "@/lib/utils/datetime";

/**
 * Berkas Excel laporan hasil try out. Semua teks ditulis sebagai TEKS (bukan rumus), jadi nama yang diawali "=" tidak
 * dijalankan Excel; NISN juga teks agar angka 0 di depan tidak hilang. Nilai ditulis sebagai angka (satu desimal).
 */
export type InfoExcel = {
  sekolah: string;
  /** Satu baris per syarat yang aktif (lihat deskripsiFilter). */
  filter: string[];
  dibuatPada: Date;
};

const angka = (n: number | null | undefined) => (n == null ? "-" : Number(n.toFixed(1)));

function lembarInfo(workbook: ExcelJS.Workbook, judul: string, info: InfoExcel, tambahan: Array<[string, string | number]>) {
  const ringkasan = workbook.addWorksheet("Ringkasan");
  ringkasan.columns = [
    { header: "Keterangan", key: "k", width: 30 },
    { header: "Nilai", key: "v", width: 50 },
  ];
  const baris: Array<[string, string | number]> = [
    ["Laporan", judul],
    ["Sekolah", info.sekolah],
    ["Dibuat pada", formatWIB(info.dibuatPada)],
    ["Syarat", info.filter.length ? info.filter.join("; ") : "Semua data"],
    ...tambahan,
    ["Catatan", "Nilai tiap siswa = percobaan PERTAMA yang sudah selesai pada tiap try out."],
  ];
  for (const [k, v] of baris) ringkasan.addRow({ k, v });
  ringkasan.getRow(1).font = { bold: true };
}

export async function buatExcelPeringkat(info: InfoExcel, baris: BarisPeringkatSiswa[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AyoTKA";
  workbook.created = info.dibuatPada;
  lembarInfo(workbook, "Peringkat Siswa", info, [["Jumlah siswa diperingkat", baris.length]]);

  const lembar = workbook.addWorksheet("Peringkat Siswa");
  lembar.columns = [
    { header: "Peringkat", key: "peringkat", width: 11 },
    { header: "Nama", key: "nama", width: 32 },
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Status", key: "status", width: 10 },
    { header: "Try out dikerjakan", key: "jumlah", width: 19 },
    { header: "Rata-rata nilai", key: "rata", width: 15 },
    { header: "Tertinggi", key: "tertinggi", width: 11 },
    { header: "Terendah", key: "terendah", width: 11 },
    { header: LABEL_JENIS_TRYOUT.mandiri, key: "mandiri", width: 18 },
    { header: LABEL_JENIS_TRYOUT.sekolah, key: "sekolah", width: 18 },
    { header: LABEL_JENIS_TRYOUT.nasional, key: "nasional", width: 18 },
    { header: "Terakhir mengerjakan", key: "terakhir", width: 24 },
  ];
  for (const b of baris) {
    lembar.addRow({
      peringkat: b.peringkat,
      nama: b.nama,
      nisn: b.nisn ?? "-",
      status: b.alumni ? "Alumni" : "Aktif",
      jumlah: b.jumlahTryOut,
      rata: angka(b.rataRata),
      tertinggi: angka(b.tertinggi),
      terendah: angka(b.terendah),
      mandiri: b.perJenis.mandiri,
      sekolah: b.perJenis.sekolah,
      nasional: b.perJenis.nasional,
      terakhir: formatWIB(b.terakhirAt),
    });
  }
  lembar.getRow(1).font = { bold: true };
  lembar.getColumn("nisn").numFmt = "@";
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export async function buatExcelPaket(
  info: InfoExcel & { paket: string; mapel: string },
  statistik: StatistikPaket,
  hasil: BarisHasilPaket[],
  belum: BarisBelum[],
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AyoTKA";
  workbook.created = info.dibuatPada;
  lembarInfo(workbook, "Performa Paket", info, [
    ["Paket", info.paket],
    ["Mata pelajaran", info.mapel],
    ["Siswa aktif (sejenjang)", statistik.siswaAktif],
    ["Sudah mengerjakan", statistik.sudahMengerjakan],
    ["Belum mengerjakan", statistik.belumMengerjakan],
    ["Di antaranya sedang mengerjakan", statistik.sedangMengerjakan],
    ["Partisipasi siswa aktif (%)", statistik.partisipasiPersen],
    ["Rata-rata nilai", angka(statistik.rataRata)],
    ["Median", angka(statistik.median)],
    ["Nilai tertinggi", angka(statistik.tertinggi)],
    ["Nilai terendah", angka(statistik.terendah)],
  ]);

  const peringkat = workbook.addWorksheet("Peringkat");
  peringkat.columns = [
    { header: "Peringkat", key: "peringkat", width: 11 },
    { header: "Nama", key: "nama", width: 32 },
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Status", key: "status", width: 10 },
    { header: "Jenis try out", key: "jenis", width: 18 },
    { header: "Nilai", key: "nilai", width: 10 },
    { header: "Durasi (menit)", key: "durasi", width: 15 },
    { header: "Mulai", key: "mulai", width: 26 },
  ];
  for (const h of hasil) {
    peringkat.addRow({
      peringkat: h.peringkat ?? "-",
      nama: h.nama,
      nisn: h.nisn ?? "-",
      status: h.alumni ? "Alumni" : "Aktif",
      jenis: LABEL_JENIS_TRYOUT[h.jenis],
      nilai: angka(h.skor),
      durasi: h.durasiMenit ?? "-",
      mulai: formatWIB(h.mulaiAt),
    });
  }
  peringkat.getRow(1).font = { bold: true };
  peringkat.getColumn("nisn").numFmt = "@";

  const lembarBelum = workbook.addWorksheet("Belum Mengerjakan");
  lembarBelum.columns = [
    { header: "Nama", key: "nama", width: 32 },
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Keterangan", key: "ket", width: 24 },
    { header: "Akun", key: "akun", width: 22 },
  ];
  for (const b of belum) {
    lembarBelum.addRow({
      nama: b.nama,
      nisn: b.nisn ?? "-",
      ket: b.status === "sedang_mengerjakan" ? "Sedang mengerjakan" : "Belum mulai",
      akun: b.claimStatus === "sudah_klaim" ? "Sudah diaktifkan" : "Belum diaktifkan",
    });
  }
  lembarBelum.getRow(1).font = { bold: true };
  lembarBelum.getColumn("nisn").numFmt = "@";
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export { namaBerkasLaporan } from "@/lib/hasil-tryout/format";
