import PDFDocument from "pdfkit";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { muatDalam, renderPeringkatPdf, type DataPeringkatPdf } from "@/lib/pdf/peringkat-renderer";
import type { BarisPeringkatSiswa } from "@/lib/hasil-tryout/susun";
import { setupFonts } from "@/lib/pdf/pdf-umum";

afterEach(() => vi.restoreAllMocks());

// Merender PDF sungguhan memuat font dan menyusun halaman: saat seluruh suite berjalan serentak bisa lebih dari 5 detik.
vi.setConfig({ testTimeout: 60_000 });

function barisContoh(n: number, o: Partial<BarisPeringkatSiswa> = {}): BarisPeringkatSiswa[] {
  return Array.from({ length: n }, (_, i) => ({
    peringkat: i < 3 ? i + 1 : i + 1,
    studentId: `s${i}`,
    nama: `Siswa Nomor ${i + 1}`,
    nisn: `99900${String(i).padStart(5, "0")}`,
    alumni: false,
    jumlahTryOut: 3 + (i % 4),
    rataRata: Math.max(0, 98 - i * 0.9),
    tertinggi: 100 - (i % 7),
    terendah: 40 + (i % 9),
    terakhirAt: new Date("2026-10-05T01:00:00Z"),
    perJenis: { mandiri: 1, sekolah: 1, nasional: 1 },
    ...o,
  }));
}

const data = (baris: BarisPeringkatSiswa[], o: Partial<DataPeringkatPdf> = {}): DataPeringkatPdf => ({
  sekolah: "SMP Negeri 1 Contoh",
  syarat: ["Jenis: Try Out Sekolah", "Alumni tidak diikutkan"],
  dicetak: "13 Oktober 2026",
  ringkasan: { jumlahSiswa: baris.length, jumlahTryOut: baris.reduce((s, b) => s + b.jumlahTryOut, 0), rataRata: 71.4 },
  baris,
  ...o,
});

async function render(d: DataPeringkatPdf, logo: Buffer | null = null) {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const kejadian: string[] = [];
  const teksAsli = doc.text.bind(doc);
  const tambahAsli = doc.addPage.bind(doc);
  vi.spyOn(doc, "text").mockImplementation(((...args: unknown[]) => {
    const hasil = (teksAsli as (...a: unknown[]) => unknown)(...args);
    if (typeof args[0] === "string") kejadian.push(`T:${args[0]}`);
    return hasil;
  }) as never);
  vi.spyOn(doc, "addPage").mockImplementation(((...a: unknown[]) => {
    kejadian.push("HALAMAN");
    return (tambahAsli as (...x: unknown[]) => unknown)(...a);
  }) as never);
  const potongan: Buffer[] = [];
  doc.on("data", (c: Buffer) => potongan.push(c));
  const selesai = new Promise<void>((r) => doc.on("end", () => r()));
  await renderPeringkatPdf(doc, d, logo);
  const halaman = doc.bufferedPageRange().count;
  doc.end();
  await selesai;
  return { kejadian, halaman, pdf: Buffer.concat(potongan), teks: kejadian.filter((e) => e.startsWith("T:")).map((e) => e.slice(2)), info: doc.info };
}

describe("PDF Peringkat Siswa", () => {
  it("memuat kepala, syarat, ringkasan, baris peringkat, dan catatan cara menghitung; PDF sah", async () => {
    const r = await render(data(barisContoh(5)));
    expect(r.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    for (const t of ["AyoTKA", "Peringkat Siswa", "SMP Negeri 1 Contoh", "Dicetak 13 Oktober 2026", "Jenis: Try Out Sekolah · Alumni tidak diikutkan", "SISWA DIPERINGKAT", "TRY OUT DIKERJAKAN", "RATA-RATA NILAI", "71,4", "PERINGKAT", "SISWA", "MANDIRI", "SEKOLAH", "NASIONAL", "JUMLAH", "RATA-RATA"]) {
      expect(r.teks, t).toContain(t);
    }
    expect(r.teks).toContain("Siswa Nomor 1");
    expect(r.teks).toContain("NISN 9990000000");
    expect(r.teks.some((t) => t.startsWith("Cara menghitung:"))).toBe(true);
    expect(r.info.Title).toBe("Peringkat Siswa - SMP Negeri 1 Contoh");
    expect(r.teks.join("\n")).not.toMatch(/NaN|undefined|null/);
  });

  it("nilai tampil dengan koma desimal; peringkat seri tampil sama; alumni ditandai", async () => {
    const baris = barisContoh(3).map((b, i) => ({ ...b, peringkat: i === 2 ? 2 : i + 1, rataRata: i === 0 ? 93.7 : 81.1, alumni: i === 1 }));
    const r = await render(data(baris));
    expect(r.teks).toContain("93,7");
    expect(r.teks.filter((t) => t === "81,1")).toHaveLength(2);
    expect(r.teks.filter((t) => t === "2")).toHaveLength(2);
    expect(r.teks).toContain("Alumni");
  });

  it("rincian jumlah try out Mandiri, Sekolah, Nasional dan jumlahnya tercetak per siswa", async () => {
    const baris = barisContoh(1, { jumlahTryOut: 5, perJenis: { mandiri: 3, sekolah: 0, nasional: 2 } });
    const r = await render(data(baris));
    // urutan kolom: peringkat, nama, NISN, Mandiri, Sekolah, Nasional, jumlah, rata-rata
    const iNisn = r.teks.indexOf("NISN 9990000000");
    expect(r.teks.slice(iNisn + 1, iNisn + 5)).toEqual(["3", "0", "2", "5"]);
  });

  it("tanpa syarat: keterangan 'semua data'; tanpa siswa: pesan kosong, tanpa baris", async () => {
    const r = await render(data([], { syarat: [], ringkasan: { jumlahSiswa: 0, jumlahTryOut: 0, rataRata: null } }));
    expect(r.teks.some((t) => t.startsWith("Semua data"))).toBe(true);
    expect(r.teks).toContain("Belum ada siswa yang bisa diperingkat pada syarat ini.");
    expect(r.teks).toContain("-");
  });

  it("nama sangat panjang dipotong satu baris dengan '…' (tidak membuat baris membengkak)", async () => {
    const nama = "MUHAMMAD ABDURRAHMAN AL-FARISI BIN ABDULLAH NASIRUDDIN AL-BANTANI AS-SUNDAWI WIRAKUSUMA";
    const r = await render(data(barisContoh(1, { nama })));
    const tercetak = r.teks.find((t) => t.startsWith("MUHAMMAD"))!;
    expect(tercetak.endsWith("…")).toBe(true);
    expect(tercetak.length).toBeLessThan(nama.length);
  });

  it("baris tidak pernah terbelah antar halaman dan kepala tabel diulang di tiap halaman, untuk 0 sampai 70 siswa", async () => {
    let adaLebihDariSatuHalaman = false;
    for (let n = 0; n <= 70; n++) {
      const r = await render(data(barisContoh(n)));
      if (r.halaman > 1) adaLebihDariSatuHalaman = true;
      const kejadian = r.kejadian;
      kejadian.forEach((e, i) => {
        if (e !== "HALAMAN") return;
        // halaman baru: teks pertama adalah kepala tabel (kecuali halaman hanya berisi catatan penutup)
        const berikut = kejadian.slice(i + 1).find((x) => x.startsWith("T:"));
        expect(["T:PERINGKAT", "T:Cara menghitung:"].some((a) => berikut?.startsWith(a)), `n=${n}: halaman baru dimulai dengan ${berikut}`).toBe(true);
      });
      // setiap siswa tercetak tepat satu kali dan semua kolomnya sebelum pindah halaman berikutnya
      for (let i = 0; i < n; i++) {
        const iNama = kejadian.indexOf(`T:Siswa Nomor ${i + 1}`);
        expect(iNama, `n=${n} siswa ${i + 1}`).toBeGreaterThan(-1);
        const akhir = kejadian.indexOf(`T:NISN 99900${String(i).padStart(5, "0")}`, iNama);
        expect(kejadian.slice(iNama, akhir + 1), `n=${n} siswa ${i + 1} terbelah`).not.toContain("HALAMAN");
      }
      // nomor halaman benar di setiap halaman
      for (let h = 1; h <= r.halaman; h++) expect(r.teks, `n=${n}`).toContain(`Halaman ${h} dari ${r.halaman}`);
    }
    expect(adaLebihDariSatuHalaman).toBe(true);
  }, 120_000);

  it("logo dipasang bila ada dan formatnya didukung; logo rusak tidak menggagalkan PDF", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
    const dengan = await render(data(barisContoh(2)), png);
    expect(dengan.pdf.toString("latin1")).toMatch(/\/Subtype\s*\/Image/);
    const rusak = await render(data(barisContoh(2)), Buffer.from("bukan gambar"));
    expect(rusak.pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(rusak.pdf.toString("latin1")).not.toMatch(/\/Subtype\s*\/Image/);
  }, 60_000);

  it("muatDalam: tidak memotong teks yang muat, memotong yang panjang dengan '…'", () => {
    const doc = new PDFDocument({ size: "A4" });
    const fonts = setupFonts(doc);
    doc.font(fonts.regular).fontSize(9);
    expect(muatDalam(doc, "  Budi   Santoso ", 400)).toBe("Budi Santoso");
    const potong = muatDalam(doc, "Nama yang sangat panjang sekali sehingga tidak muat", 80);
    expect(potong.endsWith("…")).toBe(true);
    expect(doc.widthOfString(potong)).toBeLessThanOrEqual(80);
  });
});
