import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buatRekapExcel, namaBerkasRekap } from "@/lib/exam/rekap-bersama-excel";
import { susunRekapBersama, type AttemptRekap, type PesertaRekap } from "@/lib/exam/rekap-bersama";

const peserta: PesertaRekap[] = [
  { studentId: "s1", nama: "Dina Putri", nisn: "0012345678", claimStatus: "sudah_klaim" },
  { studentId: "s2", nama: "=HYPERLINK(\"http://jahat.example\",\"klik\")", nisn: "0099999999", claimStatus: "sudah_klaim" },
  { studentId: "s3", nama: "Hana", nisn: null, claimStatus: "belum_klaim" },
  { studentId: "s4", nama: "Indra", nisn: "0011112222", claimStatus: "sudah_klaim" },
];
const attempts: AttemptRekap[] = [
  { id: "a1", studentId: "s1", status: "selesai", skorAkhir: 88.46, mulaiAt: new Date("2026-10-08T01:00:00Z"), selesaiAt: new Date("2026-10-08T01:35:00Z"), tabSwitchCount: 2 },
  { id: "a2", studentId: "s2", status: "kedaluwarsa", skorAkhir: 40, mulaiAt: new Date("2026-10-08T01:00:00Z"), selesaiAt: new Date("2026-10-08T01:30:00Z"), tabSwitchCount: 0 },
];
const info = {
  sekolah: "SMP Negeri Uji",
  paket: "Try Out Matematika 1",
  mapel: "Matematika",
  mulai: new Date("2026-10-08T01:00:00Z"),
  selesai: new Date("2026-10-08T03:00:00Z"),
  dibuatPada: new Date("2026-10-08T05:00:00Z"),
};

async function bukaBerkas() {
  const { baris, statistik } = susunRekapBersama(peserta, attempts);
  const bytes = await buatRekapExcel(info, baris, statistik);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  return wb;
}

describe("buatRekapExcel", () => {
  it("memuat tiga lembar: Ringkasan, Hasil Siswa, Belum Mengerjakan", async () => {
    const wb = await bukaBerkas();
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Ringkasan", "Hasil Siswa", "Belum Mengerjakan"]);
  });

  it("Hasil Siswa: hanya yang sudah mulai, urut peringkat, dengan nilai dan durasi", async () => {
    const ws = (await bukaBerkas()).getWorksheet("Hasil Siswa")!;
    const header = (ws.getRow(1).values as unknown[]).slice(1);
    expect(header).toEqual(["Peringkat", "Nama", "NISN", "Status", "Nilai", "Durasi (menit)", "Pindah tab", "Jumlah percobaan"]);
    expect(ws.rowCount).toBe(3);
    const baris1 = (ws.getRow(2).values as unknown[]).slice(1);
    expect(baris1).toEqual([1, "Dina Putri", "0012345678", "Selesai", 88.5, 35, 2, 1]);
    const baris2 = (ws.getRow(3).values as unknown[]).slice(1);
    expect(baris2[0]).toBe(2);
    expect(baris2[3]).toBe("Waktu habis");
    expect(baris2[4]).toBe(40);
  });

  it("NISN tetap teks dengan angka 0 di depan", async () => {
    const ws = (await bukaBerkas()).getWorksheet("Hasil Siswa")!;
    const sel = ws.getRow(2).getCell(3);
    expect(sel.value).toBe("0012345678");
    expect(sel.type).toBe(ExcelJS.ValueType.String);
  });

  it("nama berawalan '=' tersimpan sebagai TEKS, bukan rumus (tidak bisa dijalankan Excel)", async () => {
    const ws = (await bukaBerkas()).getWorksheet("Hasil Siswa")!;
    const sel = ws.getRow(3).getCell(2);
    expect(sel.type).toBe(ExcelJS.ValueType.String);
    expect(sel.formula).toBeUndefined();
    expect(String(sel.value).startsWith("=HYPERLINK")).toBe(true);
  });

  it("Belum Mengerjakan: peserta yang belum mulai, dengan status akun", async () => {
    const ws = (await bukaBerkas()).getWorksheet("Belum Mengerjakan")!;
    expect(ws.rowCount).toBe(3);
    const baris = [2, 3].map((n) => (ws.getRow(n).values as unknown[]).slice(1));
    expect(baris).toEqual([
      ["Hana", "-", "Belum diaktifkan"],
      ["Indra", "0011112222", "Sudah diaktifkan"],
    ]);
  });

  it("Ringkasan: info penugasan, hitungan, statistik, dan sebaran nilai", async () => {
    const ws = (await bukaBerkas()).getWorksheet("Ringkasan")!;
    const peta = new Map<string, unknown>();
    ws.eachRow((row) => peta.set(String(row.getCell(1).value), row.getCell(2).value));
    expect(peta.get("Sekolah")).toBe("SMP Negeri Uji");
    expect(peta.get("Paket")).toBe("Try Out Matematika 1");
    expect(String(peta.get("Jendela pengerjaan"))).toContain("8 Oktober 2026 08:00 WIB");
    expect(peta.get("Jumlah peserta")).toBe(4);
    expect(peta.get("Sudah selesai")).toBe(2);
    expect(peta.get("Belum mengerjakan")).toBe(2);
    expect(peta.get("Partisipasi (%)")).toBe(50);
    expect(peta.get("Rata-rata nilai")).toBe(64.2);
    expect(peta.get("Nilai tertinggi")).toBe(88.46);
    expect(peta.get("0 – 20")).toBe(0);
    expect(peta.get("40 – 60")).toBe(1);
    expect(peta.get("80 – 100")).toBe(1);
    expect(String(peta.get("Catatan"))).toContain("PERTAMA");
  });

  it("tanpa peserta menghasilkan berkas sah dengan tanda '-' pada statistik", async () => {
    const { baris, statistik } = susunRekapBersama([], []);
    const bytes = await buatRekapExcel(info, baris, statistik);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Ringkasan")!;
    const peta = new Map<string, unknown>();
    ws.eachRow((row) => peta.set(String(row.getCell(1).value), row.getCell(2).value));
    expect(peta.get("Rata-rata nilai")).toBe("-");
    expect(peta.get("Jumlah peserta")).toBe(0);
  });
});

describe("namaBerkasRekap", () => {
  const tgl = new Date("2026-10-08T05:00:00Z");

  it("huruf kecil, strip, tanpa simbol, ditambah tanggal", () => {
    expect(namaBerkasRekap("Try Out: Matematika/SMP #1", tgl)).toBe("rekap-try-out-bersama-try-out-matematikasmp-1-2026-10-08.xlsx");
  });

  it("nama kosong atau hanya simbol memakai 'paket'", () => {
    expect(namaBerkasRekap("", tgl)).toBe("rekap-try-out-bersama-paket-2026-10-08.xlsx");
    expect(namaBerkasRekap("!!!///", tgl)).toBe("rekap-try-out-bersama-paket-2026-10-08.xlsx");
  });

  it("nama panjang dipotong dan tidak memuat karakter berbahaya untuk header unduhan", () => {
    const nama = namaBerkasRekap(`A"b\r\nc;d${"x".repeat(200)}`, tgl);
    expect(nama).toMatch(/^[a-z0-9-]+\.xlsx$/);
    expect(nama.length).toBeLessThan(120);
  });
});
