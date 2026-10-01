import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import ExcelJS from "exceljs";
import { buildStudentImportTemplate } from "@/lib/students/excel-template";

describe("buildStudentImportTemplate", () => {
  it("menghasilkan file buffer Excel yang valid dengan 2 sheet", async () => {
    const buffer = await buildStudentImportTemplate();
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    const sheetData = workbook.getWorksheet("Data Siswa");
    const sheetPetunjuk = workbook.getWorksheet("Petunjuk Pengisian");

    expect(sheetData).toBeDefined();
    expect(sheetPetunjuk).toBeDefined();
  });

  it("memiliki kolom header yang benar di baris pertama sheet Data Siswa", async () => {
    const buffer = await buildStudentImportTemplate();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    const sheetData = workbook.getWorksheet("Data Siswa")!;
    const row1 = sheetData.getRow(1);

    expect(row1.getCell(1).value).toBe("No");
    expect(row1.getCell(2).value).toBe("Nama Lengkap");
    expect(row1.getCell(3).value).toBe("NISN");
    expect(row1.getCell(4).value).toBe("Tanggal Lahir");
  });

  it("menyertakan baris contoh yang ditandai CONTOH pada kolom No", async () => {
    const buffer = await buildStudentImportTemplate();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    const sheetData = workbook.getWorksheet("Data Siswa")!;
    const row2 = sheetData.getRow(2);
    const row3 = sheetData.getRow(3);

    expect(row2.getCell(1).value).toBe("CONTOH");
    expect(row2.getCell(2).value).toBe("Ahmad Fajar Santoso");
    expect(row2.getCell(3).value).toBe("0081234567");

    expect(row3.getCell(1).value).toBe("CONTOH");
    expect(row3.getCell(2).value).toBe("Siti Nurhaliza");
  });

  it("menyertakan sheet petunjuk pengisian yang lengkap", async () => {
    const buffer = await buildStudentImportTemplate();
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    const sheetPetunjuk = workbook.getWorksheet("Petunjuk Pengisian")!;
    const titleCell = sheetPetunjuk.getCell("B2");
    expect(titleCell.value).toContain("PETUNJUK PENGISIAN");
  });
});
