import "server-only";
import ExcelJS from "exceljs";

/**
 * Membangun template Excel (.xlsx) resmi untuk pengisian & import massal data siswa.
 * Dilengkapi dengan 2 sheet:
 * 1. "Data Siswa": format tabel rapi, styling warna AyoTKA, format Teks untuk NISN agar angka 0 tidak hilang, dan baris contoh.
 * 2. "Petunjuk Pengisian": panduan rinci aturan setiap kolom dan cara pengisian.
 */
export async function buildStudentImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AyoTKA";
  workbook.lastModifiedBy = "AyoTKA";
  workbook.created = new Date();
  workbook.modified = new Date();

  // ==========================================
  // SHEET 1: Data Siswa
  // ==========================================
  const sheet = workbook.addWorksheet("Data Siswa", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { header: "No", key: "no", width: 10 },
    { header: "Nama Lengkap", key: "nama", width: 36 },
    { header: "NISN", key: "nisn", width: 22 },
    { header: "Tanggal Lahir", key: "tanggalLahir", width: 22 },
  ];

  // Header styling (Baris 1)
  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" }, // Indigo 600
    };
    cell.font = {
      name: "Segoe UI",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF3730A3" } },
      bottom: { style: "medium", color: { argb: "FF3730A3" } },
      left: { style: "thin", color: { argb: "FF3730A3" } },
      right: { style: "thin", color: { argb: "FF3730A3" } },
    };
  });

  // Data contoh realistis (ditandai CONTOH di kolom No agar otomatis dilewati oleh sistem import)
  const sampleRows = [
    { no: "CONTOH", nama: "Ahmad Fajar Santoso", nisn: "0081234567", tanggalLahir: "2010-05-15" },
    { no: "CONTOH", nama: "Siti Nurhaliza", nisn: "0098765432", tanggalLahir: "2010-08-20" },
    { no: "CONTOH", nama: "Budi Pratama", nisn: "0075544332", tanggalLahir: "2011-01-10" },
  ];

  sampleRows.forEach((r, idx) => {
    const row = sheet.addRow(r);
    row.height = 22;
    row.eachCell((cell, colNum) => {
      cell.font = {
        name: "Segoe UI",
        size: 10,
        italic: true,
        color: { argb: "FF64748B" }, // Slate 500
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: idx % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (colNum === 1 || colNum === 3 || colNum === 4) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    });
  });

  // Baris kosong bernomor siap pakai untuk memudahkan pengisian manual di Excel
  for (let i = 1; i <= 20; i++) {
    const row = sheet.addRow({ no: i, nama: "", nisn: "", tanggalLahir: "" });
    row.height = 22;
    row.eachCell((cell, colNum) => {
      cell.font = { name: "Segoe UI", size: 10, color: { argb: "FF0F172A" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (colNum === 1 || colNum === 3 || colNum === 4) {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      }
    });
  }

  // Format NISN (Kolom C) sebagai Text ('@') agar awalan nol tidak dipotong Excel
  sheet.getColumn(3).numFmt = "@";
  // Format Tanggal Lahir (Kolom D)
  sheet.getColumn(4).numFmt = "yyyy-mm-dd";

  // ==========================================
  // SHEET 2: Petunjuk Pengisian
  // ==========================================
  const guideSheet = workbook.addWorksheet("Petunjuk Pengisian", {
    views: [{ showGridLines: true }],
  });

  guideSheet.columns = [
    { header: "", key: "c1", width: 4 },
    { header: "", key: "c2", width: 30 },
    { header: "", key: "c3", width: 70 },
  ];

  // Judul Banner
  guideSheet.mergeCells("B2:C2");
  const titleCell = guideSheet.getCell("B2");
  titleCell.value = "PETUNJUK PENGISIAN TEMPLATE IMPORT SISWA AYOTKA";
  titleCell.font = { name: "Segoe UI", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  guideSheet.getRow(2).height = 34;

  const guideItems = [
    ["1. Lembar Kerja (Sheet)", "Data siswa yang akan diimpor wajib berada pada sheet pertama bernama 'Data Siswa'."],
    ["2. Baris Judul (Header)", "Dilarang mengubah atau menghapus teks judul pada Baris 1."],
    ["3. Kolom No", "Nomor urut baris (opsional). Baris bertuliskan 'CONTOH' otomatis dilewati sistem."],
    ["4. Kolom Nama Lengkap (Wajib)", "Wajib diisi nama siswa (minimal 2 karakter)."],
    ["5. Kolom NISN (Opsional)", "10 digit angka unik. Kolom ini berformat Teks agar angka nol (0) di depan tidak hilang."],
    ["6. Kolom Tanggal Lahir (Opsional)", "Format tanggal yang didukung: YYYY-MM-DD (contoh: 2010-05-15) atau DD/MM/YYYY (contoh: 15/05/2010)."],
    ["7. Baris Kosong", "Baris yang tidak memiliki isi pada kolom 'Nama Lengkap' akan dilewati otomatis."],
    ["8. Format File", "Simpan dan unggah file dalam format .xlsx (Excel) atau .csv ke portal AyoTKA."],
  ];

  guideItems.forEach((item, idx) => {
    const rowIdx = idx + 4;
    const r = guideSheet.getRow(rowIdx);
    r.height = 24;
    const cellA = guideSheet.getCell(`B${rowIdx}`);
    const cellB = guideSheet.getCell(`C${rowIdx}`);

    cellA.value = item[0];
    cellA.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF334155" } };
    cellA.alignment = { vertical: "middle", horizontal: "left" };
    cellA.border = { bottom: { style: "thin", color: { argb: "FFF1F5F9" } } };

    cellB.value = item[1];
    cellB.font = { name: "Segoe UI", size: 10, color: { argb: "FF475569" } };
    cellB.alignment = { vertical: "middle", horizontal: "left" };
    cellB.border = { bottom: { style: "thin", color: { argb: "FFF1F5F9" } } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
