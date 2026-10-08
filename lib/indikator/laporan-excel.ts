import "server-only";
import ExcelJS from "exceljs";
import { labelPeriodeBulan } from "@/lib/utils/datetime";
import { LABEL_VONIS, type BarisIndikator, type BarisIndikatorSekolah } from "./daya-serap";
import type { DataLaporanSekolah } from "./laporan-sekolah";
import { MIN_SEKOLAH_PEMBANDING } from "./pembanding";
import { NAMA_LEVEL } from "./wawasan";

/**
 * Excel laporan daya serap per indikator sekolah. Angka disimpan sebagai ANGKA (bukan teks) supaya bisa diurutkan dan
 * dihitung ulang di Excel; persen dalam skala 0-100 dengan satu desimal. Teks selalu disimpan sebagai teks (nilai sel
 * string di xlsx tidak pernah dievaluasi sebagai rumus, jadi nama siswa yang diawali "=" aman).
 */

const FORMAT_PERSEN = "0.0";
const FORMAT_SELISIH = "+0.0;-0.0;0.0";
const WARNA_KEPALA = "FF4F46E5";

const bulat1 = (n: number) => Math.round(n * 10) / 10;

function gayaKepala(sheet: ExcelJS.Worksheet) {
  const kepala = sheet.getRow(1);
  kepala.font = { bold: true, color: { argb: "FFFFFFFF" } };
  kepala.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WARNA_KEPALA } };
  kepala.alignment = { vertical: "middle", wrapText: true };
  kepala.height = 30;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function selisihNasional(b: BarisIndikator): number | null {
  return b.nasional === null ? null : bulat1(b.dayaSerap - b.nasional);
}

const LABEL_JENIS_WAWASAN = { perhatian: "Perhatian", info: "Info", positif: "Baik" } as const;

export async function bangunExcelLaporanSekolah(data: DataLaporanSekolah, periodeLabel: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AyoTKA";
  wb.created = new Date();
  const lap = data.laporan;

  // ---- Ringkasan ----
  const ringkasan = wb.addWorksheet("Ringkasan");
  ringkasan.columns = [
    { header: "Keterangan", key: "k", width: 44 },
    { header: "Nilai", key: "v", width: 48 },
  ];
  gayaKepala(ringkasan);
  const tambah = (k: string, v: string | number) => ringkasan.addRow({ k, v });
  tambah("Sekolah", data.sekolah.nama);
  tambah("Mata pelajaran", `${data.mapel.nama} (${data.mapel.jenjang})`);
  tambah("Periode", periodeLabel);
  tambah("Siswa yang mengerjakan", data.jumlahSiswaMengerjakan);
  tambah("Percobaan pertama yang dihitung", data.jumlahPercobaan);
  tambah("Jumlah paket", data.jumlahPaket);
  const pb = data.pembanding;
  if (pb) {
    tambah("Pembanding pengguna AyoTKA", pb.label);
    tambah("Sekolah pembanding / siswa", `${pb.jumlahSekolah} / ${pb.jumlahSiswa}`);
    if (pb.cukup && pb.rerata !== null) {
      tambah("Rerata pembanding (%)", bulat1(pb.rerata));
      if (pb.posisi) tambah("Posisi sekolah", `Peringkat ${pb.posisi.peringkat} dari ${pb.posisi.dari} sekolah (lebih tinggi dari ${Math.round(pb.posisi.persentil)}% sekolah lain)`);
    } else {
      tambah("Catatan pembanding", `Belum cukup: baru ${pb.jumlahSekolah} sekolah yang punya data (minimal ${MIN_SEKOLAH_PEMBANDING}).`);
    }
  }
  if (lap) {
    const skor = lap.kelompok.reduce((a, k) => a + k.skor, 0);
    const maks = lap.kelompok.reduce((a, k) => a + k.skorMaks, 0);
    tambah("Hierarki resmi", lap.label.join(" > "));
    tambah("Jawaban berindikator resmi / seluruh jawaban", `${lap.jawabanBerindikator} / ${lap.jumlahJawaban}`);
    tambah("Daya serap keseluruhan (%)", maks > 0 ? bulat1((skor / maks) * 100) : 0);
    tambah("Siswa tingkat Baik (>= 70%)", lap.sebaran.baik);
    tambah("Siswa tingkat Cukup (50-69%)", lap.sebaran.cukup);
    tambah("Siswa tingkat Perlu latihan (< 50%)", lap.sebaran.kurang);
  } else {
    tambah("Catatan", "Belum ada soal berindikator resmi Kemendikdasmen pada percobaan di rentang ini.");
  }
  tambah(
    "Cara membaca",
    "Daya serap = skor diperoleh / skor maksimum x 100. Rerata nasional dari portal resmi daya serap TKA Kemendikdasmen adalah rujukan; vonis hanya diberikan per kelompok.",
  );
  ringkasan.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  // Kolom pembanding wilayah hanya ada bila laporan memuatnya (pembanding diminta dan cukup).
  const adaWilayah = Boolean(lap?.kelompok.some((k) => k.wilayah !== undefined));
  const labelKolomWilayah = pb ? `Rerata AyoTKA ${pb.label} (%)` : "Rerata wilayah (%)";

  if (lap) {
    // ---- Wawasan Learning Analytics ----
    if ((data.wawasan ?? []).length > 0) {
      const w = wb.addWorksheet("Wawasan");
      w.columns = [
        { header: "Jenis", key: "jenis", width: 12 },
        { header: "Wawasan", key: "teks", width: 140 },
      ];
      gayaKepala(w);
      for (const x of data.wawasan ?? []) w.addRow({ jenis: LABEL_JENIS_WAWASAN[x.jenis], teks: x.teks });
      w.getColumn("teks").alignment = { wrapText: true, vertical: "top" };
    }

    // ---- Per kelompok ----
    const kel = wb.addWorksheet("Per Kelompok");
    kel.columns = [
      { header: lap.label[0]!, key: "nama", width: 36 },
      { header: "Jawaban", key: "jml", width: 11 },
      { header: "Skor", key: "skor", width: 10 },
      { header: "Skor maks", key: "maks", width: 11 },
      { header: "Daya serap (%)", key: "daya", width: 15 },
      { header: "Rerata nasional (%)", key: "nas", width: 19 },
      { header: "Selisih (poin)", key: "sel", width: 15 },
      { header: "Vonis", key: "vonis", width: 28 },
      ...(adaWilayah
        ? [
            { header: labelKolomWilayah, key: "wil", width: 30 },
            { header: "Selisih wilayah (poin)", key: "selwil", width: 21 },
          ]
        : []),
    ];
    gayaKepala(kel);
    for (const k of lap.kelompok) {
      kel.addRow({
        nama: k.nama,
        jml: k.jmlSoal,
        skor: bulat1(k.skor),
        maks: bulat1(k.skorMaks),
        daya: bulat1(k.dayaSerap),
        nas: k.nasional === null ? null : bulat1(k.nasional),
        sel: k.selisih === null ? null : bulat1(k.selisih),
        vonis: LABEL_VONIS[k.vonis],
        ...(adaWilayah ? { wil: typeof k.wilayah === "number" ? bulat1(k.wilayah) : null, selwil: typeof k.selisihWilayah === "number" ? bulat1(k.selisihWilayah) : null } : {}),
      });
    }
    kel.getColumn("daya").numFmt = FORMAT_PERSEN;
    kel.getColumn("nas").numFmt = FORMAT_PERSEN;
    kel.getColumn("sel").numFmt = FORMAT_SELISIH;
    if (adaWilayah) {
      kel.getColumn("wil").numFmt = FORMAT_PERSEN;
      kel.getColumn("selwil").numFmt = FORMAT_SELISIH;
    }

    // ---- Per indikator ----
    const ind = wb.addWorksheet("Per Indikator");
    const kolom: Partial<ExcelJS.Column>[] = [
      { header: lap.label[0]!, key: "l1", width: 28 },
      { header: lap.label[1]!, key: "l2", width: 34 },
    ];
    if (lap.jumlahTingkat === 4) kolom.push({ header: lap.label[2]!, key: "l3", width: 40 });
    kolom.push(
      { header: "Indikator", key: "ind", width: 70 },
      { header: "Jawaban", key: "jml", width: 11 },
      { header: "Siswa", key: "siswa", width: 9 },
      { header: "Daya serap (%)", key: "daya", width: 15 },
      { header: "Rerata nasional (%)", key: "nas", width: 19 },
      { header: "Selisih (poin)", key: "sel", width: 15 },
    );
    if (adaWilayah) {
      kolom.push({ header: labelKolomWilayah, key: "wil", width: 30 }, { header: "Selisih wilayah (poin)", key: "selwil", width: 21 });
    }
    ind.columns = kolom;
    gayaKepala(ind);
    for (const k of lap.kelompok) {
      for (const b of k.baris) {
        ind.addRow({
          l1: b.level1,
          l2: b.level2,
          l3: b.level3 ?? "",
          ind: b.indikator,
          jml: b.jmlSoal,
          siswa: b.jmlSiswa,
          daya: bulat1(b.dayaSerap),
          nas: b.nasional === null ? null : bulat1(b.nasional),
          sel: selisihNasional(b),
          ...(adaWilayah
            ? { wil: typeof b.wilayah === "number" ? bulat1(b.wilayah) : null, selwil: typeof b.wilayah === "number" ? bulat1(b.dayaSerap - b.wilayah) : null }
            : {}),
        });
      }
    }
    ind.getColumn("ind").alignment = { wrapText: true, vertical: "top" };
    ind.getColumn("daya").numFmt = FORMAT_PERSEN;
    ind.getColumn("nas").numFmt = FORMAT_PERSEN;
    ind.getColumn("sel").numFmt = FORMAT_SELISIH;
    if (adaWilayah) {
      ind.getColumn("wil").numFmt = FORMAT_PERSEN;
      ind.getColumn("selwil").numFmt = FORMAT_SELISIH;
    }

    // ---- Learning Analytics otomatis: remedial dan di bawah nasional ----
    const daftar = (nama: string, baris: BarisIndikatorSekolah[]) => {
      const s = wb.addWorksheet(nama);
      s.columns = [
        { header: "No", key: "no", width: 6 },
        { header: lap.label[0]!, key: "l1", width: 28 },
        { header: "Indikator", key: "ind", width: 70 },
        { header: "Jawaban", key: "jml", width: 11 },
        { header: "Siswa", key: "siswa", width: 9 },
        { header: "Daya serap (%)", key: "daya", width: 15 },
        { header: "Rerata nasional (%)", key: "nas", width: 19 },
        { header: "Selisih (poin)", key: "sel", width: 15 },
      ];
      gayaKepala(s);
      baris.forEach((b, i) =>
        s.addRow({ no: i + 1, l1: b.level1, ind: b.indikator, jml: b.jmlSoal, siswa: b.jmlSiswa, daya: bulat1(b.dayaSerap), nas: b.nasional === null ? null : bulat1(b.nasional), sel: selisihNasional(b) }),
      );
      s.getColumn("ind").alignment = { wrapText: true, vertical: "top" };
      s.getColumn("daya").numFmt = FORMAT_PERSEN;
      s.getColumn("nas").numFmt = FORMAT_PERSEN;
      s.getColumn("sel").numFmt = FORMAT_SELISIH;
    };
    daftar("Prioritas Remedial", lap.prioritasRemedial);
    daftar("Di Bawah Nasional", lap.diBawahNasional);

    // ---- Tren bulanan dan level kognitif ----
    if (lap.tren.length > 0 || lap.perLevel.length > 0) {
      const tl = wb.addWorksheet("Tren dan Level");
      tl.columns = [
        { header: "Kategori", key: "kat", width: 20 },
        { header: "Nama", key: "nama", width: 44 },
        { header: "Jawaban", key: "jml", width: 11 },
        { header: "Siswa", key: "siswa", width: 9 },
        { header: "Daya serap (%)", key: "daya", width: 15 },
      ];
      gayaKepala(tl);
      for (const t of lap.tren) tl.addRow({ kat: "Tren bulanan", nama: labelPeriodeBulan(t.periode), jml: t.jmlSoal, siswa: t.jmlSiswa, daya: bulat1(t.dayaSerap) });
      for (const l of lap.perLevel) tl.addRow({ kat: "Level kognitif", nama: NAMA_LEVEL[l.level] ?? l.level, jml: l.jmlSoal, siswa: null, daya: bulat1(l.dayaSerap) });
      tl.getColumn("daya").numFmt = FORMAT_PERSEN;
    }

    // ---- Siswa perlu perhatian ----
    const sw = wb.addWorksheet("Siswa Perlu Perhatian");
    sw.columns = [
      { header: "No", key: "no", width: 6 },
      { header: "Nama", key: "nama", width: 32 },
      { header: "NISN", key: "nisn", width: 16 },
      { header: "Daya serap (%)", key: "daya", width: 15 },
      { header: "Jawaban", key: "jml", width: 11 },
      { header: "Indikator terlemah 1", key: "t1", width: 60 },
      { header: "Daya serap 1 (%)", key: "d1", width: 16 },
      { header: "Indikator terlemah 2", key: "t2", width: 60 },
      { header: "Daya serap 2 (%)", key: "d2", width: 16 },
    ];
    gayaKepala(sw);
    lap.siswaPerhatian.forEach((s, i) => {
      const [a, b] = s.terlemah;
      sw.addRow({
        no: i + 1,
        nama: s.nama,
        nisn: s.nisn ?? "",
        daya: bulat1(s.dayaSerap),
        jml: s.jmlSoal,
        t1: a?.indikator ?? "",
        d1: a ? bulat1(a.dayaSerap) : null,
        t2: b?.indikator ?? "",
        d2: b ? bulat1(b.dayaSerap) : null,
      });
    });
    for (const k of ["t1", "t2"]) sw.getColumn(k).alignment = { wrapText: true, vertical: "top" };
    for (const k of ["daya", "d1", "d2"]) sw.getColumn(k).numFmt = FORMAT_PERSEN;
    sw.getColumn("nisn").numFmt = "@";
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
