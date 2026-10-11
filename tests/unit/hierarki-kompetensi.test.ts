import { describe, expect, it } from "vitest";
import { bangunHierarkiKompetensi, type SkorKompetensi } from "@/lib/exam/hierarki-kompetensi";
import { kunciNamaHierarki, urutanHierarkiResmi } from "@/lib/indikator/hierarki-resmi";

let n = 0;
const k = (elemen: string, sub: string, kompetensi: string, benar: number, soal: number, o: Partial<SkorKompetensi> = {}): SkorKompetensi => ({
  kompetensiId: `k${++n}`,
  elemenId: `e-${elemen}`,
  elemenNama: elemen,
  elemenUrutan: 0,
  subElemen: sub,
  kompetensi,
  level: "L1",
  jmlBenar: benar,
  jmlSoal: soal,
  ...o,
});

// Angka persis dari rapor percobaan "PAKET A" SMP Matematika di produksi (Peta Kompetensi: Aljabar 63% 5/8, Bilangan 67% 4/6,
// Geometri dan Pengukuran 88% 7/8, Data dan Peluang 50% 4/8). Urutan di database sengaja Aljabar lebih dulu (seperti di layar lama).
const PAKET_A: SkorKompetensi[] = [
  k("Aljabar", "Barisan dan Deret", "Menghitung suku ke-n", 1, 1, { elemenUrutan: 1 }),
  k("Aljabar", "Bentuk Aljabar", "Menganalisis generalisasi", 1, 1, { elemenUrutan: 1, level: "L3" }),
  k("Aljabar", "Bentuk Aljabar", "Menghitung operasi aljabar", 1, 2, { elemenUrutan: 1, level: "L1" }),
  k("Aljabar", "Bentuk Aljabar", "Mengaplikasikan sifat operasi", 1, 1, { elemenUrutan: 1, level: "L2" }),
  k("Aljabar", "Persamaan dan Pertidaksamaan Linear", "Menghitung penyelesaian", 1, 1, { elemenUrutan: 1 }),
  k("Aljabar", "Persamaan dan Pertidaksamaan Linear", "Memodelkan permasalahan", 0, 1, { elemenUrutan: 1, level: "L2" }),
  k("Aljabar", "Persamaan dan Pertidaksamaan Linear", "Memecahkan masalah tidak rutin", 0, 1, { elemenUrutan: 1, level: "L3" }),
  k("Bilangan", "Bilangan Real", "Menganalisis hubungan sifat bilangan", 0, 2, { elemenUrutan: 2, level: "L3" }),
  k("Bilangan", "Bilangan Real", "Menghitung hasil operasi aritmetika", 1, 1, { elemenUrutan: 2, level: "L1" }),
  k("Bilangan", "Bilangan Real", "Mengaplikasikan rasio, skala, proporsi", 3, 3, { elemenUrutan: 2, level: "L2" }),
  k("Geometri dan Pengukuran", "Pengukuran", "Menghitung keliling dan luas", 1, 1, { elemenUrutan: 3 }),
  k("Geometri dan Pengukuran", "Objek Geometri", "Mengidentifikasi hubungan sudut", 1, 1, { elemenUrutan: 3 }),
  k("Geometri dan Pengukuran", "Objek Geometri", "Mengaplikasikan hubungan sudut", 1, 1, { elemenUrutan: 3, level: "L2" }),
  k("Geometri dan Pengukuran", "Transformasi Geometri", "Mengidentifikasi hasil transformasi", 1, 1, { elemenUrutan: 3 }),
  k("Geometri dan Pengukuran", "Transformasi Geometri", "Menganalisis gabungan transformasi", 1, 1, { elemenUrutan: 3, level: "L3" }),
  k("Geometri dan Pengukuran", "Pengukuran", "Mengaplikasikan rumus", 0, 1, { elemenUrutan: 3, level: "L2" }),
  k("Geometri dan Pengukuran", "Pengukuran", "Memecahkan masalah kombinasi", 1, 1, { elemenUrutan: 3, level: "L3" }),
  k("Geometri dan Pengukuran", "Objek Geometri", "Menganalisis masalah tidak rutin", 1, 1, { elemenUrutan: 3, level: "L3" }),
  k("Data dan Peluang", "Peluang", "Menghitung peluang kejadian tunggal", 1, 1, { elemenUrutan: 4 }),
  k("Data dan Peluang", "Data", "Memahami informasi penyajian data", 1, 1, { elemenUrutan: 4 }),
  k("Data dan Peluang", "Data", "Membandingkan ukuran pemusatan", 0, 2, { elemenUrutan: 4, level: "L3" }),
  k("Data dan Peluang", "Peluang", "Mengaplikasikan konsep peluang", 1, 2, { elemenUrutan: 4, level: "L2" }),
  k("Data dan Peluang", "Peluang", "Menganalisis peluang situasi baru", 0, 1, { elemenUrutan: 4, level: "L3" }),
  k("Data dan Peluang", "Data", "Menginterpretasikan ukuran data", 1, 1, { elemenUrutan: 4, level: "L2" }),
];

const L1 = (baris: ReturnType<typeof bangunHierarkiKompetensi>) => baris.filter((b) => b.level === 1);
const teksLevel = (baris: ReturnType<typeof bangunHierarkiKompetensi>, level: 1 | 2 | 3) => baris.filter((b) => b.level === level).map((b) => b.teks);

describe("urutanHierarkiResmi", () => {
  it("SMP Matematika: urutan elemen dan subelemen resmi (huruf besar/kecil dinormalkan, tidak ganda)", () => {
    const u = urutanHierarkiResmi("SMP", "Matematika")!;
    expect(u.elemen).toEqual(["bilangan", "aljabar", "geometri dan pengukuran", "data dan peluang"]);
    expect(u.subelemen.get("bilangan")).toEqual(["bilangan real"]); // "Bilangan Real" dan "Bilangan real" di data master = satu
    expect(u.subelemen.get("aljabar")).toEqual(["bentuk aljabar", "fungsi", "persamaan dan pertidaksamaan linear", "barisan dan deret"]);
    expect(u.subelemen.get("geometri dan pengukuran")).toEqual(["objek geometri", "transformasi geometri", "pengukuran"]);
    expect(u.subelemen.get("data dan peluang")).toEqual(["data", "peluang"]);
  });

  it("SD Matematika memakai hierarki SD; Bahasa Indonesia hanya urutan tingkat pertama", () => {
    const sd = urutanHierarkiResmi("sd", "Matematika")!;
    expect(sd.elemen[0]).toBe("bilangan");
    expect(sd.subelemen.get("bilangan")).toEqual(["bilangan rasional"]);
    const bin = urutanHierarkiResmi("SMP", "Bahasa Indonesia")!;
    expect(bin.elemen).toEqual(["pemahaman tekstual", "evaluasi dan apresiasi", "pemahaman inferensial"]);
    expect(bin.subelemen.size).toBe(0);
  });

  it("jenjang atau mapel tanpa hierarki resmi -> null", () => {
    expect(urutanHierarkiResmi("SMA", "Matematika")).toBeNull();
    expect(urutanHierarkiResmi("SMP", "IPA")).toBeNull();
    expect(urutanHierarkiResmi("", "Matematika")).toBeNull();
  });

  it("kunciNamaHierarki", () => {
    expect(kunciNamaHierarki("  Bilangan   Real ")).toBe("bilangan real");
  });
});

describe("bangunHierarkiKompetensi", () => {
  it("tanpa data -> kosong", () => {
    expect(bangunHierarkiKompetensi([])).toEqual([]);
    expect(bangunHierarkiKompetensi([], urutanHierarkiResmi("SMP", "Matematika"))).toEqual([]);
  });

  it("angka tiap elemen persis sama dengan Peta Kompetensi di rapor (63%, 67%, 88%, 50%)", () => {
    const e = L1(bangunHierarkiKompetensi(PAKET_A, urutanHierarkiResmi("SMP", "Matematika")));
    const ringkas = Object.fromEntries(e.map((b) => [b.teks, [b.jmlBenar, b.jmlSoal, Math.round(b.persentase!)]]));
    expect(ringkas).toEqual({
      Aljabar: [5, 8, 63],
      Bilangan: [4, 6, 67],
      "Geometri dan Pengukuran": [7, 8, 88],
      "Data dan Peluang": [4, 8, 50],
    });
  });

  it("diurutkan mengikuti hierarki resmi: elemen, subelemen, lalu kompetensi dari level terendah", () => {
    const b = bangunHierarkiKompetensi(PAKET_A, urutanHierarkiResmi("SMP", "Matematika"));
    // semua baris di bawah satu elemen (sampai elemen berikutnya)
    const bagian = (elemen: string) => {
      const i = b.findIndex((x) => x.level === 1 && x.teks === elemen);
      let j = i + 1;
      while (j < b.length && b[j]!.level > 1) j++;
      return b.slice(i + 1, j);
    };
    expect(teksLevel(b, 1)).toEqual(["Bilangan", "Aljabar", "Geometri dan Pengukuran", "Data dan Peluang"]);
    expect(b.filter((x) => x.level === 1).map((x) => x.nomor)).toEqual([1, 2, 3, 4]);
    // urutan resmi Aljabar: Bentuk Aljabar, (Fungsi - tidak diuji), Persamaan dan Pertidaksamaan Linear, Barisan dan Deret
    expect(bagian("Aljabar").filter((x) => x.level === 2).map((x) => x.teks)).toEqual([
      "Bentuk Aljabar",
      "Persamaan dan Pertidaksamaan Linear",
      "Barisan dan Deret",
    ]);
    expect(bagian("Geometri dan Pengukuran").filter((x) => x.level === 2).map((x) => x.teks)).toEqual(["Objek Geometri", "Transformasi Geometri", "Pengukuran"]);
    expect(bagian("Data dan Peluang").filter((x) => x.level === 2).map((x) => x.teks)).toEqual(["Data", "Peluang"]);
    // di dalam satu subelemen: level kognitif L1, L2, L3
    const idx = b.findIndex((x) => x.level === 2 && x.teks === "Bentuk Aljabar");
    expect(b.slice(idx + 1, idx + 4).map((x) => x.teks)).toEqual(["Menghitung operasi aljabar", "Mengaplikasikan sifat operasi", "Menganalisis generalisasi"]);
  });

  it("jumlah benar dan soal tiap elemen dan subelemen = jumlah kompetensi di bawahnya", () => {
    const b = bangunHierarkiKompetensi(PAKET_A, urutanHierarkiResmi("SMP", "Matematika"));
    b.forEach((x, i) => {
      if (x.level === 3) return;
      let benar = 0;
      let soal = 0;
      for (let j = i + 1; j < b.length && b[j]!.level > x.level; j++) {
        if (b[j]!.level === 3) {
          benar += b[j]!.jmlBenar;
          soal += b[j]!.jmlSoal;
        }
      }
      expect({ benar, soal }, x.teks).toEqual({ benar: x.jmlBenar, soal: x.jmlSoal });
    });
  });

  it("tanpa urutan resmi: elemen menurut urutan di database, subelemen abjad", () => {
    const b = bangunHierarkiKompetensi(PAKET_A, null);
    expect(teksLevel(b, 1)).toEqual(["Aljabar", "Bilangan", "Geometri dan Pengukuran", "Data dan Peluang"]);
    expect(teksLevel(b, 2).slice(0, 3)).toEqual(["Barisan dan Deret", "Bentuk Aljabar", "Persamaan dan Pertidaksamaan Linear"]);
  });

  it("elemen/subelemen yang tidak dikenal hierarki resmi ditaruh SESUDAH yang dikenal, tanpa hilang", () => {
    const b = bangunHierarkiKompetensi(
      [
        k("Elemen Baru", "Sub X", "Kompetensi X", 1, 2, { elemenUrutan: 0 }),
        k("Bilangan", "Sub Tidak Resmi", "Kompetensi A", 1, 1, { elemenUrutan: 9 }),
        k("Bilangan", "Bilangan Real", "Kompetensi B", 1, 1, { elemenUrutan: 9 }),
      ],
      urutanHierarkiResmi("SMP", "Matematika"),
    );
    expect(teksLevel(b, 1)).toEqual(["Bilangan", "Elemen Baru"]);
    expect(teksLevel(b, 2)).toEqual(["Bilangan Real", "Sub Tidak Resmi", "Sub X"]);
    expect(b.filter((x) => x.level === 3)).toHaveLength(3);
  });

  it("elemen dicocokkan lewat nama di database walau nama tampilnya berbeda (penyesuaian Kerangka Asesmen)", () => {
    // "Aljabar" tampil sebagai "Aljabar (tampil)" tetapi tetap dikenal sebagai elemen resmi, jadi mendahului elemen tak dikenal
    // walau urutan di database sebaliknya. Tanpa pencocokan lewat nama asli, urutannya akan terbalik.
    const b = bangunHierarkiKompetensi(
      [
        k("Elemen X", "Sub X", "KX", 1, 1, { elemenUrutan: 0 }),
        k("Aljabar", "Bentuk Aljabar", "KA", 1, 1, { elemenNama: "Aljabar (tampil)", elemenNamaAsli: "Aljabar", elemenId: "ea", elemenUrutan: 5 }),
      ],
      urutanHierarkiResmi("SMP", "Matematika"),
    );
    expect(teksLevel(b, 1)).toEqual(["Aljabar (tampil)", "Elemen X"]);
    // subelemen resminya pun ikut dikenali lewat nama asli elemen
    const dua = bangunHierarkiKompetensi(
      [
        k("Aljabar", "Barisan dan Deret", "K1", 1, 1, { elemenNama: "Aljabar (tampil)", elemenNamaAsli: "Aljabar", elemenId: "ea" }),
        k("Aljabar", "Bentuk Aljabar", "K2", 1, 1, { elemenNama: "Aljabar (tampil)", elemenNamaAsli: "Aljabar", elemenId: "ea" }),
      ],
      urutanHierarkiResmi("SMP", "Matematika"),
    );
    expect(teksLevel(dua, 2)).toEqual(["Bentuk Aljabar", "Barisan dan Deret"]);
  });

  it("nama subelemen berbeda huruf besar/kecil digabung; subelemen kosong menjadi 'Lainnya'", () => {
    const b = bangunHierarkiKompetensi([
      k("Bilangan", "Bilangan Real", "K1", 1, 1),
      k("Bilangan", "Bilangan real", "K2", 0, 1),
      k("Bilangan", "", "K3", 1, 1),
      k("Bilangan", "   ", "K4", 0, 2),
    ]);
    expect(teksLevel(b, 2)).toEqual(["Bilangan Real", "Lainnya"]);
    expect(b.find((x) => x.teks === "Bilangan Real")).toMatchObject({ jmlBenar: 1, jmlSoal: 2, persentase: 50 });
    expect(b.find((x) => x.teks === "Lainnya")).toMatchObject({ jmlBenar: 1, jmlSoal: 3 });
  });

  it("kompetensi tanpa soal -> persentase null (bukan NaN atau 0%)", () => {
    const b = bangunHierarkiKompetensi([k("Bilangan", "Bilangan Real", "K1", 0, 0)]);
    expect(b.every((x) => x.persentase === null)).toBe(true);
    expect(JSON.stringify(b)).not.toContain("NaN");
  });

  it("id tiap baris unik dan stabil; hasil bisa dikirim sebagai JSON", () => {
    const b = bangunHierarkiKompetensi(PAKET_A, urutanHierarkiResmi("SMP", "Matematika"));
    expect(new Set(b.map((x) => x.id)).size).toBe(b.length);
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
    expect(b).toHaveLength(37); // 4 elemen + 9 subelemen + 24 kompetensi
  });
});
