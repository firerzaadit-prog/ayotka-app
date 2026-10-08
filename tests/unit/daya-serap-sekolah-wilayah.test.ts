import { describe, expect, it } from "vitest";
import { hitungLaporanSekolah, type InfoIndikator, type JawabanSiswa } from "@/lib/indikator/daya-serap";

const ind = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `i${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: n <= 2 ? "Bilangan" : "Aljabar",
  subelemen: "Sub",
  kompetensi: `Kompetensi ${n}`,
  indikator: `Indikator ${n} (${n})`,
  urutan: n,
  nilaiNasional: 50,
  ...o,
});
const jw = (studentId: string, i: InfoIndikator, skor: number, o: Partial<JawabanSiswa> = {}): JawabanSiswa => ({
  studentId,
  indikator: i,
  skor,
  skorMaks: 1,
  ...o,
});
/** n siswa menjawab satu indikator; `benar` di antaranya benar. */
const kelas = (i: InfoIndikator, n: number, benar: number, o: Partial<JawabanSiswa> = {}) =>
  Array.from({ length: n }, (_, k) => jw(`s${i.id}-${k}`, i, k < benar ? 1 : 0, o));

const MURID = (jawaban: JawabanSiswa[]) => [...new Set(jawaban.map((j) => j.studentId))].map((studentId) => ({ studentId, nama: studentId, nisn: null }));
const hitung = (jawaban: JawabanSiswa[], peta?: Map<string, number>) => hitungLaporanSekolah(jawaban, MURID(jawaban), peta ? { pembandingWilayah: peta } : undefined)!;
const semuaBaris = (l: ReturnType<typeof hitung>) => l.kelompok.flatMap((k) => k.baris);

describe("hitungLaporanSekolah - pembanding wilayah", () => {
  const jawaban = [...kelas(ind(1), 10, 6), ...kelas(ind(2), 10, 8), ...kelas(ind(3), 10, 2)];

  it("tanpa pembanding: bidang wilayah TIDAK ada sama sekali (perilaku lama)", () => {
    const l = hitung(jawaban);
    for (const b of semuaBaris(l)) expect(b).not.toHaveProperty("wilayah");
    for (const k of l.kelompok) {
      expect(k).not.toHaveProperty("wilayah");
      expect(k).not.toHaveProperty("selisihWilayah");
    }
  });

  it("baris mendapat angka wilayah bila indikatornya lolos ambang; yang tidak lolos null", () => {
    const l = hitung(jawaban, new Map([["i1", 50], ["i3", 40]]));
    const peta = Object.fromEntries(semuaBaris(l).map((b) => [b.indikatorId, b.wilayah]));
    expect(peta).toEqual({ i1: 50, i2: null, i3: 40 });
  });

  it("kelompok: rerata wilayah tertimbang skor maksimum pada indikator yang punya pembanding, dan selisihnya", () => {
    // Bilangan: i1 (6/10 = 60%, wilayah 50), i2 (8/10 = 80%, wilayah 70) -> bobot sama
    const l = hitung(jawaban, new Map([["i1", 50], ["i2", 70]]));
    const bilangan = l.kelompok.find((k) => k.nama === "Bilangan")!;
    expect(bilangan.wilayah).toBeCloseTo(60, 5);
    expect(bilangan.selisihWilayah).toBeCloseTo(70 - 60, 5); // daya serap sekolah 14/20 = 70%
  });

  it("selisih memakai HANYA indikator yang punya pembanding (apel dengan apel)", () => {
    // i1 punya pembanding (60% vs 50); i2 tidak: selisih = 60 - 50 = 10, bukan (70 - 50)
    const l = hitung(jawaban, new Map([["i1", 50]]));
    const bilangan = l.kelompok.find((k) => k.nama === "Bilangan")!;
    expect(bilangan.wilayah).toBe(50);
    expect(bilangan.selisihWilayah).toBeCloseTo(10, 5);
  });

  it("bobot menurut skor maksimum sekolah pada indikator itu", () => {
    const berat = [...kelas(ind(1), 30, 15), ...kelas(ind(2), 10, 10)]; // i1: 50% (30 soal), i2: 100% (10 soal)
    const l = hitung(berat, new Map([["i1", 40], ["i2", 90]]));
    expect(l.kelompok[0]!.wilayah).toBeCloseTo((40 * 30 + 90 * 10) / 40, 5);
  });

  it("kelompok tanpa satu pun indikator berpembanding: wilayah dan selisih null (bidangnya ada karena pembanding diminta)", () => {
    const l = hitung(jawaban, new Map([["i1", 50]]));
    const aljabar = l.kelompok.find((k) => k.nama === "Aljabar")!;
    expect(aljabar).toHaveProperty("wilayah", null);
    expect(aljabar).toHaveProperty("selisihWilayah", null);
  });

  it("peta pembanding kosong (diminta tetapi belum ada yang lolos): semua null", () => {
    const l = hitung(jawaban, new Map());
    for (const b of semuaBaris(l)) expect(b.wilayah).toBeNull();
    for (const k of l.kelompok) expect(k.wilayah).toBeNull();
  });

  it("pembanding wilayah tidak mengubah angka sekolah, vonis nasional, maupun urutan", () => {
    const tanpa = hitung(jawaban);
    const dengan = hitung(jawaban, new Map([["i1", 10], ["i2", 90]]));
    expect(dengan.kelompok.map((k) => [k.nama, k.dayaSerap, k.nasional, k.selisih, k.vonis])).toEqual(
      tanpa.kelompok.map((k) => [k.nama, k.dayaSerap, k.nasional, k.selisih, k.vonis]),
    );
    expect(dengan.sebaran).toEqual(tanpa.sebaran);
    expect(dengan.prioritasRemedial.map((b) => b.indikatorId)).toEqual(tanpa.prioritasRemedial.map((b) => b.indikatorId));
  });

  it("daftar remedial dan di-bawah-nasional memakai objek baris yang sama (membawa angka wilayah)", () => {
    const l = hitung(jawaban, new Map([["i3", 40]]));
    expect(l.prioritasRemedial.find((b) => b.indikatorId === "i3")?.wilayah).toBe(40);
  });
});

describe("hitungLaporanSekolah - tren bulanan", () => {
  it("daya serap per bulan, urut waktu, dari jawaban yang membawa informasi bulan", () => {
    const i = ind(1);
    const jawaban = [
      ...kelas(i, 10, 5, { bulan: "2026-10" }),
      ...Array.from({ length: 10 }, (_, k) => jw(`t${k}`, i, k < 8 ? 1 : 0, { bulan: "2026-09" })),
    ];
    const l = hitung(jawaban);
    expect(l.tren.map((t) => [t.periode, t.dayaSerap, t.jmlSoal])).toEqual([
      ["2026-09", 80, 10],
      ["2026-10", 50, 10],
    ]);
  });

  it("jumlah siswa per bulan dihitung berbeda (satu siswa menjawab banyak soal = satu siswa)", () => {
    const i = ind(1);
    const jawaban = [jw("a", i, 1, { bulan: "2026-10" }), jw("a", i, 0, { bulan: "2026-10" }), jw("b", i, 1, { bulan: "2026-10" })];
    expect(hitung(jawaban).tren[0]).toMatchObject({ jmlSoal: 3, jmlSiswa: 2 });
  });

  it("tanpa informasi bulan: tren kosong; jawaban tanpa indikator atau skor maksimum 0 tidak dihitung", () => {
    const i = ind(1);
    expect(hitung(kelas(i, 5, 3)).tren).toEqual([]);
    const jawaban = [...kelas(i, 4, 2, { bulan: "2026-10" }), { studentId: "x", indikator: null, skor: 1, skorMaks: 1, bulan: "2026-11" }, jw("y", i, 1, { bulan: "2026-12", skorMaks: 0 })];
    expect(hitung(jawaban).tren.map((t) => t.periode)).toEqual(["2026-10"]);
  });

  it("skor dijepit ke 0..skor maksimum", () => {
    const i = ind(1);
    const l = hitung([jw("a", i, 5, { bulan: "2026-10" }), jw("b", i, -3, { bulan: "2026-10" })]);
    expect(l.tren[0]!.dayaSerap).toBe(50);
  });
});

describe("hitungLaporanSekolah - per level kognitif", () => {
  it("urut L1, L2, L3 walau datanya acak; daya serap per level", () => {
    const i = ind(1);
    const jawaban = [...kelas(i, 10, 3, { level: "L3" }), ...kelas(i, 10, 9, { level: "L1" }), ...kelas(i, 10, 6, { level: "L2" })];
    const l = hitung(jawaban);
    expect(l.perLevel.map((x) => [x.level, x.dayaSerap, x.jmlSoal])).toEqual([
      ["L1", 90, 10],
      ["L2", 60, 10],
      ["L3", 30, 10],
    ]);
  });

  it("level di luar L1-L3 ditaruh di akhir; tanpa informasi level: kosong", () => {
    const i = ind(1);
    expect(hitung([...kelas(i, 2, 1, { level: "Z9" }), ...kelas(i, 2, 1, { level: "L2" })]).perLevel.map((x) => x.level)).toEqual(["L2", "Z9"]);
    expect(hitung(kelas(i, 4, 2)).perLevel).toEqual([]);
  });
});
