import { describe, expect, it } from "vitest";
import { LABEL_JENIS_TRYOUT, kodeSoalPaket, rentangWaktuPengerjaan, tentukanJenisTryOut } from "@/lib/exam/jenis-tryout";
import { namaBerkasRapor } from "@/lib/pdf/nama-berkas";

describe("tentukanJenisTryOut", () => {
  const jenis = (kategori: "mandiri" | "nasional", assignmentId: string | null, ownerType: "pusat" | "sekolah" | null) =>
    tentukanJenisTryOut({ kategori, assignmentId, ownerType });

  it("paket nasional selalu Try Out Nasional (juga bila ditugaskan lewat penugasan atau milik sekolah)", () => {
    expect(jenis("nasional", null, "pusat")).toBe("nasional");
    expect(jenis("nasional", "tugas-1", "pusat")).toBe("nasional");
    expect(jenis("nasional", "tugas-1", "sekolah")).toBe("nasional");
  });

  it("ujian yang dijadwalkan sekolah (ada penugasan) atau paket milik sekolah = Try Out Sekolah", () => {
    expect(jenis("mandiri", "tugas-1", "pusat")).toBe("sekolah");
    expect(jenis("mandiri", "tugas-1", "sekolah")).toBe("sekolah");
    expect(jenis("mandiri", null, "sekolah")).toBe("sekolah");
  });

  it("paket pusat yang dipilih siswa sendiri = Try Out Mandiri; data kosong tidak membuat galat", () => {
    expect(jenis("mandiri", null, "pusat")).toBe("mandiri");
    expect(jenis("mandiri", null, null)).toBe("mandiri");
    expect(tentukanJenisTryOut({ kategori: "mandiri", assignmentId: undefined, ownerType: undefined })).toBe("mandiri");
    expect(tentukanJenisTryOut({ kategori: "mandiri", assignmentId: "", ownerType: "pusat" })).toBe("mandiri");
  });

  it("label tiga jenis", () => {
    expect(LABEL_JENIS_TRYOUT).toEqual({ mandiri: "Try Out Mandiri", sekolah: "Try Out Sekolah", nasional: "Try Out Nasional" });
  });
});

describe("kodeSoalPaket", () => {
  it("kode dari soal.ayotka.id dipakai bila ada (dipangkas)", () => {
    expect(kodeSoalPaket("71b222eb-472c-4b11-9bc2-170adc610384", "  MAT-SD-PT1 ")).toBe("MAT-SD-PT1");
  });

  it("tanpa kode impor: PKT- + 8 karakter pertama ID paket, huruf besar", () => {
    expect(kodeSoalPaket("71b222eb-472c-4b11-9bc2-170adc610384", null)).toBe("PKT-71B222EB");
    expect(kodeSoalPaket("71b222eb-472c-4b11-9bc2-170adc610384", undefined)).toBe("PKT-71B222EB");
    expect(kodeSoalPaket("71b222eb-472c-4b11-9bc2-170adc610384", "   ")).toBe("PKT-71B222EB");
  });

  it("ID aneh atau kosong: tidak melempar", () => {
    expect(kodeSoalPaket("", null)).toBe("-");
    expect(kodeSoalPaket("---", null)).toBe("-");
    expect(kodeSoalPaket("ab", null)).toBe("PKT-AB");
  });

  it("dua paket berbeda mendapat kode berbeda", () => {
    expect(kodeSoalPaket("11111111-aaaa", null)).not.toBe(kodeSoalPaket("22222222-aaaa", null));
  });
});

describe("rentangWaktuPengerjaan (WIB)", () => {
  const mulai = new Date("2026-10-12T08:38:00.000Z"); // 15.38 WIB

  it("jam mulai - jam selesai dalam WIB dan lamanya dalam menit", () => {
    expect(rentangWaktuPengerjaan(mulai, new Date("2026-10-12T09:12:00.000Z"))).toBe("15.38 - 16.12 WIB (34 menit)");
  });

  it("tanpa waktu selesai: hanya jam mulai", () => {
    expect(rentangWaktuPengerjaan(mulai, null)).toBe("mulai 15.38 WIB");
    expect(rentangWaktuPengerjaan(mulai, undefined)).toBe("mulai 15.38 WIB");
  });

  it("waktu selesai sebelum mulai atau tidak sah: hanya jam mulai (tanpa durasi negatif)", () => {
    expect(rentangWaktuPengerjaan(mulai, new Date("2026-10-12T08:00:00.000Z"))).toBe("mulai 15.38 WIB");
    expect(rentangWaktuPengerjaan(mulai, new Date("tidak sah"))).toBe("mulai 15.38 WIB");
  });

  it("durasi di bawah semenit dibulatkan menjadi 1 menit", () => {
    expect(rentangWaktuPengerjaan(mulai, new Date("2026-10-12T08:38:20.000Z"))).toBe("15.38 - 15.38 WIB (1 menit)");
  });

  it("mulai tidak sah: '-'", () => {
    expect(rentangWaktuPengerjaan(new Date("tidak sah"), null)).toBe("-");
  });

  it("melewati tengah malam WIB tetap benar", () => {
    expect(rentangWaktuPengerjaan(new Date("2026-10-12T16:50:00.000Z"), new Date("2026-10-12T17:20:00.000Z"))).toBe("23.50 - 00.20 WIB (30 menit)");
  });
});

describe("namaBerkasRapor", () => {
  const tanggal = new Date("2026-10-12T08:38:00.000Z");

  it("nama, jenis Try Out, dan tanggal ujian (WIB) dalam ASCII yang aman untuk header", () => {
    expect(namaBerkasRapor("Budi Santoso", "nasional", tanggal)).toBe("Rapor-Budi-Santoso-Try-Out-Nasional-2026-10-12.pdf");
    expect(namaBerkasRapor("Siti", "mandiri", tanggal)).toBe("Rapor-Siti-Try-Out-Mandiri-2026-10-12.pdf");
    expect(namaBerkasRapor("Siti", "sekolah", tanggal)).toBe("Rapor-Siti-Try-Out-Sekolah-2026-10-12.pdf");
  });

  it("tanggal memakai hari WIB (pukul 23.30 WIB masih hari itu, bukan hari UTC berikutnya)", () => {
    expect(namaBerkasRapor("A", "mandiri", new Date("2026-10-12T16:30:00.000Z"))).toBe("Rapor-A-Try-Out-Mandiri-2026-10-12.pdf");
    expect(namaBerkasRapor("A", "mandiri", new Date("2026-10-12T17:30:00.000Z"))).toBe("Rapor-A-Try-Out-Mandiri-2026-10-13.pdf");
  });

  it("tanda kutip, garis miring, huruf beraksen, dan non-Latin tidak merusak header", () => {
    for (const nama of ['Budi "Si" Santoso', "Budi/Santoso\\..", "Béatrice Ñandú", 'a\r\nContent-Type: text/html', "名字", "../../etc/passwd"]) {
      const berkas = namaBerkasRapor(nama, "mandiri", tanggal);
      expect(berkas, nama).toMatch(/^[A-Za-z0-9.-]+$/);
      expect(berkas).not.toContain("..");
      expect(berkas.endsWith(".pdf")).toBe(true);
      expect(berkas.startsWith("Rapor-")).toBe(true);
    }
    expect(namaBerkasRapor("Béatrice Ñandú", "mandiri", tanggal)).toBe("Rapor-Beatrice-Nandu-Try-Out-Mandiri-2026-10-12.pdf");
  });

  it("nama kosong atau tidak terbaca: 'Siswa'; nama panjang dipotong", () => {
    expect(namaBerkasRapor("", "mandiri", tanggal)).toBe("Rapor-Siswa-Try-Out-Mandiri-2026-10-12.pdf");
    expect(namaBerkasRapor("名字", null, tanggal)).toBe("Rapor-Siswa-2026-10-12.pdf");
    const panjang = namaBerkasRapor("Nama Panjang ".repeat(40), "mandiri", tanggal);
    expect(panjang.length).toBeLessThan(120);
  });

  it("tanpa jenis atau tanggal: bagian itu dilewati", () => {
    expect(namaBerkasRapor("Siti", null, tanggal)).toBe("Rapor-Siti-2026-10-12.pdf");
    expect(namaBerkasRapor("Siti", "nasional", null)).toBe("Rapor-Siti-Try-Out-Nasional.pdf");
    expect(namaBerkasRapor("Siti", "nasional", new Date("tidak sah"))).toBe("Rapor-Siti-Try-Out-Nasional.pdf");
  });
});
