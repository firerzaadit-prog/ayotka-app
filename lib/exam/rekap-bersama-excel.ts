import ExcelJS from "exceljs";
import { formatWIB } from "@/lib/utils/datetime";
import { LABEL_STATUS_PESERTA, type BarisRekap, type StatistikRekap } from "@/lib/exam/rekap-bersama";

export type InfoRekapExcel = {
  sekolah: string;
  paket: string;
  mapel: string;
  mulai: Date | string;
  selesai: Date | string;
  dibuatPada: Date;
};

/**
 * Berkas Excel rekap Try Out Bersama: lembar "Ringkasan" (info, statistik, sebaran), "Hasil Siswa" (peringkat dan
 * nilai resmi), "Semua Percobaan" (riwayat lengkap tiap siswa) dan "Belum Mengerjakan". Semua teks ditulis sebagai TEKS (bukan rumus), jadi nama yang diawali "=" tidak
 * dijalankan Excel; NISN juga teks agar angka 0 di depan tidak hilang.
 */
export async function buatRekapExcel(info: InfoRekapExcel, baris: BarisRekap[], statistik: StatistikRekap): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AyoTKA";
  workbook.created = info.dibuatPada;

  const ringkasan = workbook.addWorksheet("Ringkasan");
  ringkasan.columns = [
    { header: "Keterangan", key: "k", width: 30 },
    { header: "Nilai", key: "v", width: 44 },
  ];
  const rata = (n: number | null) => (n === null ? "-" : n);
  const rows: [string, string | number][] = [
    ["Sekolah", info.sekolah],
    ["Paket", info.paket],
    ["Mata pelajaran", info.mapel],
    ["Jendela pengerjaan", `${formatWIB(info.mulai)} s.d. ${formatWIB(info.selesai)}`],
    ["Dibuat pada", formatWIB(info.dibuatPada)],
    ["Jumlah peserta", statistik.jumlahPeserta],
    ["Sudah selesai", statistik.jumlahSelesai],
    ["Sedang mengerjakan", statistik.jumlahSedang],
    ["Belum mengerjakan", statistik.jumlahBelum],
    ["Partisipasi (%)", statistik.partisipasiPersen],
    ["Rata-rata nilai", rata(statistik.rataRata)],
    ["Nilai tertinggi", rata(statistik.tertinggi)],
    ["Nilai terendah", rata(statistik.terendah)],
    ["Median", rata(statistik.median)],
    ["Catatan", "Nilai tiap siswa = percobaan PERTAMA pada penugasan ini."],
  ];
  for (const [k, v] of rows) ringkasan.addRow({ k, v });
  ringkasan.addRow({});
  ringkasan.addRow({ k: "Sebaran nilai", v: "Jumlah siswa" });
  for (const s of statistik.sebaran) ringkasan.addRow({ k: s.label, v: s.jumlah });
  ringkasan.getRow(1).font = { bold: true };

  const hasil = workbook.addWorksheet("Hasil Siswa");
  hasil.columns = [
    { header: "Peringkat", key: "peringkat", width: 11 },
    { header: "Nama", key: "nama", width: 32 },
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Status", key: "status", width: 22 },
    { header: "Nilai", key: "nilai", width: 10 },
    { header: "Durasi (menit)", key: "durasi", width: 15 },
    { header: "Pindah tab", key: "tab", width: 12 },
    { header: "Jumlah percobaan", key: "percobaan", width: 18 },
  ];
  for (const b of baris.filter((x) => x.status !== "belum")) {
    hasil.addRow({
      peringkat: b.peringkat ?? "-",
      nama: b.nama,
      nisn: b.nisn ?? "-",
      status: LABEL_STATUS_PESERTA[b.status],
      nilai: b.skor === null ? "-" : Number(b.skor.toFixed(1)),
      durasi: b.durasiMenit ?? "-",
      tab: b.tabSwitchCount,
      percobaan: b.jumlahPercobaan,
    });
  }
  hasil.getRow(1).font = { bold: true };
  hasil.getColumn("nisn").numFmt = "@";

  // Riwayat LENGKAP: setiap percobaan setiap siswa (tidak ada yang disembunyikan); hanya yang pertama berstatus resmi.
  const semua = workbook.addWorksheet("Semua Percobaan");
  semua.columns = [
    { header: "Nama", key: "nama", width: 32 },
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Percobaan ke", key: "nomor", width: 14 },
    { header: "Nilai resmi?", key: "resmi", width: 14 },
    { header: "Status", key: "status", width: 22 },
    { header: "Nilai", key: "nilai", width: 10 },
    { header: "Durasi (menit)", key: "durasi", width: 15 },
    { header: "Mulai", key: "mulai", width: 28 },
    { header: "Selesai", key: "selesai", width: 28 },
    { header: "Pindah tab", key: "tab", width: 12 },
  ];
  for (const b of baris) {
    for (const p of b.percobaan) {
      semua.addRow({
        nama: b.nama,
        nisn: b.nisn ?? "-",
        nomor: p.nomor,
        resmi: p.resmi ? "Ya" : "Tidak",
        status: LABEL_STATUS_PESERTA[p.status],
        nilai: p.skor === null ? "-" : Number(p.skor.toFixed(1)),
        durasi: p.durasiMenit ?? "-",
        mulai: formatWIB(p.mulaiAt),
        selesai: p.selesaiAt ? formatWIB(p.selesaiAt) : "-",
        tab: p.tabSwitchCount,
      });
    }
  }
  semua.getRow(1).font = { bold: true };
  semua.getColumn("nisn").numFmt = "@";

  const belum = workbook.addWorksheet("Belum Mengerjakan");
  belum.columns = [
    { header: "Nama", key: "nama", width: 32 },
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Akun", key: "akun", width: 22 },
  ];
  for (const b of baris.filter((x) => x.status === "belum")) {
    belum.addRow({ nama: b.nama, nisn: b.nisn ?? "-", akun: b.claimStatus === "sudah_klaim" ? "Sudah diaktifkan" : "Belum diaktifkan" });
  }
  belum.getRow(1).font = { bold: true };
  belum.getColumn("nisn").numFmt = "@";

  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** Nama berkas aman: huruf, angka, strip; panjang dibatasi. */
export function namaBerkasRekap(paket: string, tanggal: Date): string {
  const slug = paket
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);
  return `rekap-try-out-bersama-${slug || "paket"}-${tanggal.toISOString().slice(0, 10)}.xlsx`;
}
