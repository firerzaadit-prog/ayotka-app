import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Font DejaVu tidak ikut ter-bundle di server (mis. konfigurasi tracing salah): rapor harus tetap jadi dengan font
// standar PDF, dengan penanda ASCII sebagai ganti simbol yang tidak ada di font itu.
vi.mock("@/lib/pdf/pdf-umum", async (aslinya) => {
  const asli = await aslinya<typeof import("@/lib/pdf/pdf-umum")>();
  return { ...asli, setupFonts: () => ({ regular: "Helvetica", bold: "Helvetica-Bold", unicode: false, sz: (n: number) => n }) };
});

import { ANALISIS_CONTOH, IDENTITAS_CONTOH, buatHasilContoh } from "../helpers/rapor-fixture";
import { renderUji } from "../helpers/pdf-uji";

describe("PDF rapor tanpa font Unicode (cadangan Helvetica)", () => {
  it("rapor lengkap tetap jadi; penanda memakai padanan ASCII, tidak ada simbol di luar WinAnsi", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 8, ranking: true, stimulus: true, media: true }), { analisis: ANALISIS_CONTOH, identitas: { ...IDENTITAS_CONTOH, jenisTryOut: "nasional" } });
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(r.teks).toContain("[v] Kunci jawaban");
    expect(r.teks).toContain("[x] Jawaban siswa (salah)");
    expect(r.teks).toContain("> Bilangan Cacah dan Bulat");
    expect(r.teks).toContain("• Baik (>=70%)");
    expect(r.teks).toContain("- Latih soal keliling bangun gabungan dengan menggambar ulang bentuknya dan mencoret sisi yang berimpit sebelum menjumlahkan.");
    expect(r.gabung).not.toMatch(/[✓✗●≥]/);
    expect(r.teks).toContain("Try Out Nasional");
    expect(r.halaman).toBeGreaterThan(2);
  });

  it("diagram SVG tetap digambar dengan font standar", async () => {
    const r = await renderUji(await buatHasilContoh({ jumlahSoal: 1, media: true }));
    expect(r.teks).toContain("Diagram Presisi (SVG)");
    expect(r.gabung).not.toContain("gagal digambar");
  });
});
