import { describe, expect, it } from "vitest";
import {
  AMBANG_REMEDIAL,
  MIN_JAWABAN_ANALITIK,
  MIN_SOAL_VONIS,
  TOLERANSI_SETARA,
  bangunBaris,
  hitungLaporanSekolah,
  hitungLaporanSiswa,
  kelompokkan,
  pilihTerlemahTerkuat,
  vonisBanding,
  type InfoIndikator,
  type JawabanBerindikator,
  type JawabanSiswa,
} from "@/lib/indikator/daya-serap";

const mat = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `mat-${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: n <= 2 ? "Bilangan" : "Aljabar",
  subelemen: n <= 2 ? "Bilangan Real" : "Persamaan",
  kompetensi: `Kompetensi ${n}`,
  indikator: `Indikator mat ${n} (${n})`,
  urutan: n,
  nilaiNasional: 50,
  ...o,
});
const bin = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `bin-${n}`,
  jenjang: "SMP",
  namaMapel: "Bahasa Indonesia",
  elemen: n <= 2 ? "Pemahaman Tekstual" : "Pemahaman Inferensial",
  subelemen: `Subkompetensi ${n}`,
  kompetensi: `Subkompetensi ${n}`,
  indikator: `Indikator bin ${n} (${n})`,
  urutan: n,
  nilaiNasional: 60,
  ...o,
});
const jw = (indikator: InfoIndikator | null, skor: number | null, skorMaks = 1): JawabanBerindikator => ({ indikator, skor, skorMaks });
const ulang = (n: number, ind: InfoIndikator, benar: number): JawabanBerindikator[] =>
  Array.from({ length: n }, (_, i) => jw(ind, i < benar ? 1 : 0));

describe("vonisBanding", () => {
  it("tanpa rerata nasional -> tanpa pembanding (walau soal banyak)", () => {
    expect(vonisBanding(90, null, 50)).toBe("tanpa_pembanding");
  });
  it(`soal kurang dari ${MIN_SOAL_VONIS} -> data belum cukup, tidak menyimpulkan`, () => {
    expect(vonisBanding(100, 10, MIN_SOAL_VONIS - 1)).toBe("data_kurang");
    expect(vonisBanding(100, 10, MIN_SOAL_VONIS)).toBe("di_atas");
  });
  it("di atas / setara / perlu penguatan dengan toleransi setara tepat di batas", () => {
    expect(vonisBanding(60, 50, 10)).toBe("di_atas");
    expect(vonisBanding(40, 50, 10)).toBe("perlu_penguatan");
    expect(vonisBanding(50, 50, 10)).toBe("setara");
    expect(vonisBanding(50 + TOLERANSI_SETARA - 0.01, 50, 10)).toBe("setara");
    expect(vonisBanding(50 - TOLERANSI_SETARA + 0.01, 50, 10)).toBe("setara");
    expect(vonisBanding(50 + TOLERANSI_SETARA, 50, 10)).toBe("di_atas");
    expect(vonisBanding(50 - TOLERANSI_SETARA, 50, 10)).toBe("perlu_penguatan");
  });
});

describe("bangunBaris", () => {
  it("menjumlahkan skor dan skor maksimum per indikator (nilai sebagian ikut: bukan hanya benar/salah)", () => {
    const b = bangunBaris([jw(mat(1), 1), jw(mat(1), 0.5, 1), jw(mat(1), 0, 2), jw(mat(2), 2, 2)]);
    const satu = b.find((x) => x.indikatorId === "mat-1")!;
    expect(satu).toMatchObject({ jmlSoal: 3, skor: 1.5, skorMaks: 4 });
    expect(satu.dayaSerap).toBeCloseTo(37.5, 10);
    expect(b.find((x) => x.indikatorId === "mat-2")).toMatchObject({ jmlSoal: 1, dayaSerap: 100 });
  });

  it("soal tanpa indikator dan skor maksimum <= 0 diabaikan; skor null dihitung 0", () => {
    const b = bangunBaris([jw(null, 1), jw(mat(1), 1, 0), jw(mat(1), null), jw(mat(1), 1)]);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ jmlSoal: 2, skor: 1, skorMaks: 2, dayaSerap: 50 });
  });

  it("skor dijepit ke 0..skorMaks (data aneh tidak menghasilkan di luar 0-100%)", () => {
    const b = bangunBaris([jw(mat(1), 5, 1), jw(mat(2), -3, 1)]);
    expect(b.find((x) => x.indikatorId === "mat-1")!.dayaSerap).toBe(100);
    expect(b.find((x) => x.indikatorId === "mat-2")!.dayaSerap).toBe(0);
  });

  it("level hierarki: Matematika 4 tingkat (kompetensi terisi), Bahasa 3 tingkat (level3 kosong)", () => {
    const [m] = bangunBaris([jw(mat(1), 1)]);
    expect(m).toMatchObject({ level1: "Bilangan", level2: "Bilangan Real", level3: "Kompetensi 1" });
    const [b] = bangunBaris([jw(bin(1), 1)]);
    expect(b).toMatchObject({ level1: "Pemahaman Tekstual", level2: "Subkompetensi 1", level3: null });
  });

  it("rerata nasional indikator dibawa apa adanya (null tetap null)", () => {
    const b = bangunBaris([jw(mat(1, { nilaiNasional: 34.09 }), 1), jw(mat(2, { nilaiNasional: null }), 1)]);
    expect(b.find((x) => x.indikatorId === "mat-1")!.nasional).toBe(34.09);
    expect(b.find((x) => x.indikatorId === "mat-2")!.nasional).toBeNull();
  });
});

describe("kelompokkan", () => {
  it("mengelompokkan per tingkat pertama, terurut menurut urutan indikator; baris di dalamnya juga", () => {
    const k = kelompokkan(bangunBaris([jw(mat(3), 1), jw(mat(2), 1), jw(mat(1), 1), jw(mat(4), 1)]));
    expect(k.map((g) => g.nama)).toEqual(["Bilangan", "Aljabar"]);
    expect(k[0]!.baris.map((b) => b.urutan)).toEqual([1, 2]);
    expect(k[1]!.baris.map((b) => b.urutan)).toEqual([3, 4]);
  });

  it("daya serap kelompok = jumlah skor / jumlah skor maks (bukan rata-rata persentase indikator)", () => {
    const [g] = kelompokkan(bangunBaris([...ulang(4, mat(1), 4), ...ulang(1, mat(2), 0)]));
    expect(g!.dayaSerap).toBeCloseTo(80, 10); // 4/5, bukan (100+0)/2
    expect(g).toMatchObject({ jmlSoal: 5, skor: 4, skorMaks: 5 });
  });

  it("rerata nasional kelompok tertimbang skor maksimum", () => {
    const [g] = kelompokkan(
      bangunBaris([...ulang(3, mat(1, { nilaiNasional: 30 }), 3), ...ulang(1, mat(2, { nilaiNasional: 70 }), 1)]),
    );
    expect(g!.nasional).toBeCloseTo((30 * 3 + 70 * 1) / 4, 10); // 40
  });

  it("vonis kelompok: siswa 100% vs nasional 40 -> di atas; selisih positif", () => {
    const [g] = kelompokkan(bangunBaris([...ulang(4, mat(1, { nilaiNasional: 40 }), 4)]));
    expect(g).toMatchObject({ vonis: "di_atas" });
    expect(g!.selisih).toBeCloseTo(60, 10);
  });

  it("vonis kelompok: siswa 25% vs nasional 50 -> perlu penguatan; selisih negatif", () => {
    const [g] = kelompokkan(bangunBaris(ulang(4, mat(1, { nilaiNasional: 50 }), 1)));
    expect(g).toMatchObject({ vonis: "perlu_penguatan" });
    expect(g!.selisih).toBeCloseTo(-25, 10);
  });

  it("kelompok dengan sedikit soal -> data belum cukup (tidak menyimpulkan dari 1-2 soal)", () => {
    const [g] = kelompokkan(bangunBaris(ulang(2, mat(1), 2)));
    expect(g!.vonis).toBe("data_kurang");
  });

  it("tanpa rerata nasional sama sekali -> tanpa pembanding, nasional dan selisih null", () => {
    const [g] = kelompokkan(bangunBaris(ulang(5, mat(1, { nilaiNasional: null }), 5)));
    expect(g).toMatchObject({ vonis: "tanpa_pembanding", nasional: null, selisih: null });
  });

  it("sebagian indikator tanpa nasional: pembanding HANYA pada yang punya (apel dengan apel)", () => {
    // indikator 1 (punya nasional 50): 4/4 = 100%. indikator 2 (tanpa nasional): 0/4. Pembanding hanya indikator 1.
    const [g] = kelompokkan(bangunBaris([...ulang(4, mat(1, { nilaiNasional: 50 }), 4), ...ulang(4, mat(2, { nilaiNasional: null }), 0)]));
    expect(g!.dayaSerap).toBe(50); // keseluruhan 4/8
    expect(g!.nasional).toBe(50);
    expect(g!.selisih).toBeCloseTo(50, 10); // 100% vs 50 pada indikator pembanding
    expect(g!.vonis).toBe("di_atas");
  });

  it("daftar kosong -> tidak ada kelompok", () => {
    expect(kelompokkan([])).toEqual([]);
  });
});

describe("pilihTerlemahTerkuat", () => {
  const baris = (daya: number[]) => bangunBaris(daya.flatMap((d, i) => [jw(mat(i + 1, { urutan: i + 1 }), d / 100, 1)]));

  it("terlemah = tiga terendah yang belum 100%; terkuat = tiga tertinggi di luar terlemah", () => {
    const b = baris([10, 90, 50, 70, 30, 100]);
    const { terlemah, terkuat } = pilihTerlemahTerkuat(b);
    expect(terlemah.map((x) => x.dayaSerap)).toEqual([10, 30, 50]);
    expect(terkuat.map((x) => x.dayaSerap)).toEqual([100, 90, 70]);
  });

  it("indikator yang sudah 100% tidak pernah disebut 'terlemah'; semua 100% -> terlemah kosong", () => {
    const { terlemah, terkuat } = pilihTerlemahTerkuat(baris([100, 100, 100, 100]));
    expect(terlemah).toEqual([]);
    expect(terkuat).toHaveLength(3);
  });

  it("indikator 0% tidak pernah disebut 'terkuat'; semua 0% -> terkuat kosong", () => {
    const { terlemah, terkuat } = pilihTerlemahTerkuat(baris([0, 0, 0, 0]));
    expect(terlemah).toHaveLength(3);
    expect(terkuat).toEqual([]);
  });

  it("satu indikator saja: masuk terlemah (bila <100) dan terkuat kosong; tidak ada yang muncul di dua daftar", () => {
    const r1 = pilihTerlemahTerkuat(baris([40]));
    expect(r1.terlemah).toHaveLength(1);
    expect(r1.terkuat).toEqual([]);
    const { terlemah, terkuat } = pilihTerlemahTerkuat(baris([10, 20, 30, 40, 50]));
    const dua = new Set([...terlemah, ...terkuat].map((x) => x.indikatorId));
    expect(dua.size).toBe(terlemah.length + terkuat.length);
  });

  it("seri daya serap: yang lebih jauh di bawah rujukan nasional jadi terlemah lebih dulu; lalu soal lebih banyak; lalu urutan", () => {
    const a = bangunBaris([jw(mat(1, { nilaiNasional: 40 }), 0.5), jw(mat(2, { nilaiNasional: 80 }), 0.5), jw(mat(3, { nilaiNasional: 80 }), 0, 1), jw(mat(3, { nilaiNasional: 80 }), 1, 1)]);
    // mat-1 50% (nasional 40, jarak +10), mat-2 50% (nasional 80, jarak -30), mat-3 50% dari 2 soal (nasional 80, jarak -30)
    const { terlemah } = pilihTerlemahTerkuat(a);
    expect(terlemah.map((x) => x.indikatorId)).toEqual(["mat-3", "mat-2", "mat-1"]); // mat-3 punya 2 soal > mat-2 1 soal (seri jarak sama)
  });

  it("deterministik: urutan masukan tidak mengubah hasil", () => {
    const b = baris([30, 30, 30, 60, 60, 60, 90]);
    const a1 = pilihTerlemahTerkuat(b).terlemah.map((x) => x.indikatorId);
    const a2 = pilihTerlemahTerkuat([...b].reverse()).terlemah.map((x) => x.indikatorId);
    expect(a2).toEqual(a1);
  });

  it("tidak mengubah larik masukan", () => {
    const b = baris([30, 10, 20]);
    const salinan = b.map((x) => x.indikatorId);
    pilihTerlemahTerkuat(b);
    expect(b.map((x) => x.indikatorId)).toEqual(salinan);
  });
});

describe("hitungLaporanSiswa", () => {
  it("tidak ada soal yang tertaut ke indikator resmi -> null (bagian tidak ditampilkan)", () => {
    expect(hitungLaporanSiswa([jw(null, 1), jw(null, 0)])).toBeNull();
    expect(hitungLaporanSiswa([])).toBeNull();
    expect(hitungLaporanSiswa([jw(mat(1), 1, 0)])).toBeNull();
  });

  it("Matematika: 4 tingkat; label resmi Elemen > Subelemen > Kompetensi > Indikator", () => {
    const r = hitungLaporanSiswa([...ulang(3, mat(1), 3), ...ulang(3, mat(3), 0)])!;
    expect(r.jumlahTingkat).toBe(4);
    expect(r.label).toEqual(["Elemen", "Subelemen", "Kompetensi", "Indikator"]);
    expect(r.kelompok.map((k) => k.nama)).toEqual(["Bilangan", "Aljabar"]);
    expect(r).toMatchObject({ mapel: "Matematika", jenjang: "SMP", soalTercakup: 6, soalTotal: 6 });
  });

  it("Bahasa Indonesia: 3 tingkat; TIDAK ADA label Elemen/Subelemen, level3 kosong", () => {
    const r = hitungLaporanSiswa([...ulang(3, bin(1), 3), ...ulang(3, bin(3), 0)])!;
    expect(r.jumlahTingkat).toBe(3);
    expect(r.label).toEqual(["Kompetensi", "Subkompetensi", "Indikator"]);
    expect(r.label.join(" ")).not.toMatch(/Elemen|Subelemen/);
    expect(r.kelompok.map((k) => k.nama)).toEqual(["Pemahaman Tekstual", "Pemahaman Inferensial"]);
    expect(r.kelompok.flatMap((k) => k.baris).every((b) => b.level3 === null)).toBe(true);
  });

  it("soalTercakup membedakan soal berindikator dari seluruh soal percobaan", () => {
    const r = hitungLaporanSiswa([...ulang(4, mat(1), 4), jw(null, 1), jw(null, 0), jw(mat(2), 1, 0)])!;
    expect(r.soalTercakup).toBe(4);
    expect(r.soalTotal).toBe(7);
  });

  it("indikator dari mapel/jenjang lain di percobaan yang sama diabaikan (konteks yang dominan dipakai)", () => {
    const r = hitungLaporanSiswa([...ulang(5, mat(1), 5), ...ulang(2, bin(1), 0), ...ulang(1, mat(2, { jenjang: "SD" }), 0)])!;
    expect(r.mapel).toBe("Matematika");
    expect(r.jenjang).toBe("SMP");
    expect(r.soalTercakup).toBe(5);
    expect(r.soalTotal).toBe(8);
    expect(r.kelompok.flatMap((k) => k.baris).map((b) => b.indikatorId)).toEqual(["mat-1"]);
  });

  it("terlemah dan terkuat terisi; vonis kelompok mengikuti pembanding nasional", () => {
    const r = hitungLaporanSiswa([...ulang(4, mat(1, { nilaiNasional: 30 }), 4), ...ulang(4, mat(3, { nilaiNasional: 70 }), 1)])!;
    expect(r.terlemah[0]!.indikatorId).toBe("mat-3");
    expect(r.terkuat[0]!.indikatorId).toBe("mat-1");
    expect(r.kelompok.find((k) => k.nama === "Bilangan")!.vonis).toBe("di_atas");
    expect(r.kelompok.find((k) => k.nama === "Aljabar")!.vonis).toBe("perlu_penguatan");
  });
});

describe("hitungLaporanSekolah", () => {
  const sw = (id: string, ind: InfoIndikator | null, skor: number, skorMaks = 1): JawabanSiswa => ({ studentId: id, indikator: ind, skor, skorMaks });
  const siswa = (...id: string[]) => id.map((s) => ({ studentId: s, nama: `Siswa ${s}`, nisn: `NISN-${s}` }));
  /** n siswa menjawab indikator ind; `benar` di antaranya benar. */
  const kelas = (ind: InfoIndikator, n: number, benar: number, awalan = "s"): JawabanSiswa[] =>
    Array.from({ length: n }, (_, i) => sw(`${awalan}${i}`, ind, i < benar ? 1 : 0));

  it("kosong atau tanpa indikator resmi -> null", () => {
    expect(hitungLaporanSekolah([], [])).toBeNull();
    expect(hitungLaporanSekolah([sw("a", null, 1)], siswa("a"))).toBeNull();
  });

  it("menghitung siswa berbeda per indikator dan cakupan jawaban", () => {
    const r = hitungLaporanSekolah([...kelas(mat(1), 6, 3), ...kelas(mat(2), 4, 4), sw("s0", null, 1), sw("s1", null, 0)], siswa("s0", "s1", "s2", "s3", "s4", "s5"))!;
    expect(r.jumlahSiswa).toBe(6);
    expect(r.jumlahJawaban).toBe(12);
    expect(r.jawabanBerindikator).toBe(10);
    const baris = r.kelompok.flatMap((k) => k.baris);
    expect(baris.find((b) => b.indikatorId === "mat-1")).toMatchObject({ jmlSiswa: 6, jmlSoal: 6, dayaSerap: 50 });
    expect(baris.find((b) => b.indikatorId === "mat-2")).toMatchObject({ jmlSiswa: 4, dayaSerap: 100 });
  });

  it(`prioritas remedial: butuh >= ${MIN_JAWABAN_ANALITIK} jawaban, daya serap < ${AMBANG_REMEDIAL}%, terendah dulu, maksimal 5`, () => {
    const jawaban = [
      ...kelas(mat(1), 10, 1, "a"), // 10%
      ...kelas(mat(2), 10, 3, "b"), // 30%
      ...kelas(mat(3), 10, 5, "c"), // 50%
      ...kelas(mat(4), 10, 6, "d"), // 60%
      ...kelas(mat(5), 10, 9, "e"), // 90% (tidak remedial)
      ...kelas(mat(6), 4, 0, "f"), // 0% tetapi hanya 4 jawaban: belum cukup bukti
      ...kelas(mat(7), 10, 2, "g"), // 20%
      ...kelas(mat(8), 10, 4, "h"), // 40%
    ];
    const r = hitungLaporanSekolah(jawaban, [])!;
    expect(r.prioritasRemedial.map((b) => b.indikatorId)).toEqual(["mat-1", "mat-7", "mat-2", "mat-8", "mat-3"]);
    expect(r.prioritasRemedial.map((b) => b.indikatorId)).not.toContain("mat-6");
    expect(r.prioritasRemedial.map((b) => b.indikatorId)).not.toContain("mat-5");
  });

  it("di bawah nasional: butuh cukup jawaban, hanya yang benar-benar di bawah, selisih terbesar dulu", () => {
    const jawaban = [
      ...kelas(mat(1, { nilaiNasional: 80 }), 10, 5, "a"), // 50 vs 80: -30
      ...kelas(mat(2, { nilaiNasional: 60 }), 10, 5, "b"), // 50 vs 60: -10
      ...kelas(mat(3, { nilaiNasional: 40 }), 10, 5, "c"), // 50 vs 40: di atas
      ...kelas(mat(4, { nilaiNasional: null }), 10, 0, "d"), // tanpa pembanding
      ...kelas(mat(5, { nilaiNasional: 90 }), 3, 0, "e"), // di bawah tetapi hanya 3 jawaban
    ];
    const r = hitungLaporanSekolah(jawaban, [])!;
    expect(r.diBawahNasional.map((b) => b.indikatorId)).toEqual(["mat-1", "mat-2"]);
  });

  it("prioritas remedial TIDAK memuat indikator di atas ambang walau daftar belum penuh", () => {
    const r = hitungLaporanSekolah([...kelas(mat(1), 10, 2, "a"), ...kelas(mat(2), 10, 6, "b"), ...kelas(mat(3), 10, 9, "c"), ...kelas(mat(4), 10, 7, "d")], [])!;
    // 20% dan 60% di bawah ambang 70%; 90% dan tepat 70% tidak
    expect(r.prioritasRemedial.map((b) => b.indikatorId)).toEqual(["mat-1", "mat-2"]);
  });

  it("di bawah nasional: selisih kecil dalam toleransi 'setara' tidak dihitung; tepat di batas toleransi dihitung", () => {
    const r = hitungLaporanSekolah(
      [
        ...kelas(mat(1, { nilaiNasional: 50.3 }), 10, 5, "a"), // 50 vs 50,3: selisih -0,3 -> setara
        ...kelas(mat(2, { nilaiNasional: 50 }), 10, 5, "b"), // sama persis -> setara
        ...kelas(mat(3, { nilaiNasional: 50 + TOLERANSI_SETARA }), 10, 5, "c"), // tepat -0,5 -> di bawah
        ...kelas(mat(4, { nilaiNasional: 49 }), 10, 5, "d"), // di atas nasional
      ],
      [],
    )!;
    expect(r.diBawahNasional.map((b) => b.indikatorId)).toEqual(["mat-3"]);
  });

  it("sebaran siswa memakai ambang tier yang sama dengan Peta Kompetensi (>=70 baik, 50-69 cukup, <50 perlu latihan)", () => {
    // tiap siswa menjawab 10 soal pada satu indikator
    const per = (id: string, benar: number) => Array.from({ length: 10 }, (_, i) => sw(id, mat(1), i < benar ? 1 : 0));
    const r = hitungLaporanSekolah([...per("a", 10), ...per("b", 7), ...per("c", 6), ...per("d", 5), ...per("e", 4), ...per("f", 0)], siswa("a", "b", "c", "d", "e", "f"))!;
    expect(r.sebaran).toEqual({ baik: 2, cukup: 2, kurang: 2 });
  });

  it("siswa perlu perhatian: hanya tier kurang, terendah dulu, dengan dua indikator terlemahnya dan data identitas", () => {
    const s1 = [sw("x", mat(1), 0), sw("x", mat(1), 0), sw("x", mat(2), 0), sw("x", mat(3), 1), sw("x", mat(3), 0)]; // 1/5 = 20%
    const s2 = [sw("y", mat(1), 1), sw("y", mat(2), 0), sw("y", mat(3), 0)]; // 33%
    const s3 = [sw("z", mat(1), 1), sw("z", mat(2), 1)]; // 100%
    const r = hitungLaporanSekolah([...s1, ...s2, ...s3], siswa("x", "y", "z"))!;
    expect(r.siswaPerhatian.map((s) => s.studentId)).toEqual(["x", "y"]);
    expect(r.siswaPerhatian[0]).toMatchObject({ nama: "Siswa x", nisn: "NISN-x", jmlSoal: 5 });
    expect(r.siswaPerhatian[0]!.dayaSerap).toBeCloseTo(20, 10);
    expect(r.siswaPerhatian[0]!.terlemah).toHaveLength(2);
    expect(r.siswaPerhatian[0]!.terlemah.every((b) => b.dayaSerap < 100)).toBe(true);
    expect(r.sebaran).toEqual({ baik: 1, cukup: 0, kurang: 2 });
  });

  it("siswa yang tidak ada di daftar identitas tidak menjatuhkan laporan", () => {
    const r = hitungLaporanSekolah([sw("hantu", mat(1), 0), sw("hantu", mat(1), 0)], [])!;
    expect(r.siswaPerhatian[0]).toMatchObject({ nama: "(tanpa nama)", nisn: null });
  });

  it("kelompok sekolah memakai bentuk yang sama dengan rapor siswa (vonis di tingkat kelompok)", () => {
    const r = hitungLaporanSekolah(kelas(mat(1, { nilaiNasional: 80 }), 10, 4), [])!;
    expect(r.kelompok).toHaveLength(1);
    expect(r.kelompok[0]).toMatchObject({ nama: "Bilangan", vonis: "perlu_penguatan", jmlSoal: 10 });
    expect(r.kelompok[0]!.baris[0]).toMatchObject({ jmlSiswa: 10 });
  });

  it("Bahasa Indonesia di laporan sekolah: label 3 tingkat tanpa Elemen/Subelemen", () => {
    const r = hitungLaporanSekolah(kelas(bin(1), 6, 3), [])!;
    expect(r.label).toEqual(["Kompetensi", "Subkompetensi", "Indikator"]);
    expect(r.jumlahTingkat).toBe(3);
  });

  it("jawaban mapel lain tidak ikut dihitung dalam laporan mapel yang dipilih", () => {
    const r = hitungLaporanSekolah([...kelas(mat(1), 6, 3), ...kelas(bin(1), 2, 0, "z")], [])!;
    expect(r.mapel).toBe("Matematika");
    expect(r.jawabanBerindikator).toBe(6);
    expect(r.jumlahJawaban).toBe(8);
  });
});
