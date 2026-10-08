import { describe, expect, it } from "vitest";
import { hitungLaporanSekolah, type InfoIndikator, type JawabanSiswa } from "@/lib/indikator/daya-serap";
import { susunPembanding, type AgregatSekolahWilayah } from "@/lib/indikator/pembanding";
import { MIN_JAWABAN_LEVEL, MIN_JAWABAN_TREN, susunWawasan, type Wawasan } from "@/lib/indikator/wawasan";
import { FILTER_WILAYAH_KOSONG } from "@/lib/wilayah/cakupan";

const mat = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `m${n}`,
  jenjang: "SMP",
  namaMapel: "Matematika",
  elemen: n <= 2 ? "Bilangan" : "Aljabar",
  subelemen: "Sub",
  kompetensi: `Kompetensi ${n}`,
  indikator: `Indikator mat ${n} (${n})`,
  urutan: n,
  nilaiNasional: null,
  ...o,
});
const bin = (n: number, o: Partial<InfoIndikator> = {}): InfoIndikator => ({
  id: `b${n}`,
  jenjang: "SMP",
  namaMapel: "Bahasa Indonesia",
  elemen: n <= 2 ? "Pemahaman Tekstual" : "Pemahaman Inferensial",
  subelemen: `Sub ${n}`,
  kompetensi: `Sub ${n}`,
  indikator: `Indikator bin ${n} (${n})`,
  urutan: n,
  nilaiNasional: null,
  ...o,
});
let urut = 0;
const jw = (i: InfoIndikator | null, skor: number, o: Partial<JawabanSiswa> = {}): JawabanSiswa => ({
  studentId: o.studentId ?? `s${urut++}`,
  indikator: i,
  skor,
  skorMaks: 1,
  ...o,
});
/** n jawaban pada indikator i dari n siswa berbeda; `benar` di antaranya benar. */
const kelas = (i: InfoIndikator | null, n: number, benar: number, o: Partial<JawabanSiswa> = {}) => Array.from({ length: n }, (_, k) => jw(i, k < benar ? 1 : 0, o));
const laporan = (jawaban: JawabanSiswa[]) => {
  const murid = [...new Set(jawaban.map((j) => j.studentId))].map((studentId) => ({ studentId, nama: studentId, nisn: null }));
  return hitungLaporanSekolah(jawaban, murid)!;
};
const teks = (w: Wawasan[]) => w.map((x) => x.teks);
const cari = (w: Wawasan[], pola: RegExp) => w.find((x) => pola.test(x.teks));

const sekolahAgregat = (skor: number, id = "x"): AgregatSekolahWilayah => ({ schoolId: id, skor, skorMaks: 100, jmlSiswa: 10 });
/** Skor pertama = sekolah sendiri (id "sendiri"); `idPemilik` mengganti siapa pemilik laporan (mis. sekolah di luar cakupan). */
const pembandingCukup = (rerataSkor: number[], idPemilik = "sendiri") =>
  susunPembanding({
    filter: FILTER_WILAYAH_KOSONG,
    indikator: [],
    sekolah: rerataSkor.map((s, i) => sekolahAgregat(s, i === 0 ? "sendiri" : `lain${i}`)),
    schoolIdSendiri: idPemilik,
  });

describe("susunWawasan - pembanding wilayah", () => {
  const jawaban = [...kelas(mat(1), 10, 7), ...kelas(mat(3), 10, 7)]; // keseluruhan 70%

  it("tanpa pembanding: tidak ada kalimat pembanding", () => {
    expect(teks(susunWawasan(laporan(jawaban))).some((t) => /pengguna AyoTKA/.test(t))).toBe(false);
    expect(teks(susunWawasan(laporan(jawaban), null)).some((t) => /pengguna AyoTKA/.test(t))).toBe(false);
  });

  it("di atas rerata wilayah: positif, menyebut angka, selisih, dan jumlah sekolah", () => {
    const w = susunWawasan(laporan(jawaban), pembandingCukup([70, 50, 40]));
    const k = cari(w, /rerata pengguna AyoTKA/)!;
    expect(k.jenis).toBe("positif");
    expect(k.teks).toBe("Daya serap sekolah ini 70,0% di atas rerata pengguna AyoTKA (Nasional · Negeri + Swasta) 53,3% (+16,7 poin), dari 3 sekolah.");
  });

  it("di bawah rerata wilayah: perhatian", () => {
    const w = susunWawasan(laporan(jawaban), pembandingCukup([70, 90, 80]));
    expect(cari(w, /rerata pengguna AyoTKA/)).toMatchObject({ jenis: "perhatian" });
    expect(cari(w, /rerata pengguna AyoTKA/)!.teks).toContain("di bawah rerata");
    expect(cari(w, /rerata pengguna AyoTKA/)!.teks).toContain("(-10,0 poin)");
  });

  it("setara (selisih < 0,5 poin): info tanpa selisih", () => {
    const w = susunWawasan(laporan(jawaban), pembandingCukup([70, 70.2, 69.9]));
    const k = cari(w, /rerata pengguna AyoTKA/)!;
    expect(k.jenis).toBe("info");
    expect(k.teks).toContain("setara dengan rerata");
    expect(k.teks).not.toContain("poin)");
  });

  it("posisi sekolah: peringkat, jumlah sekolah, dan persentil", () => {
    const w = susunWawasan(laporan(jawaban), pembandingCukup([70, 90, 80, 60]));
    expect(cari(w, /^Posisi sekolah/)!.teks).toBe("Posisi sekolah ini: peringkat 3 dari 4 sekolah (daya serap lebih tinggi daripada 33% sekolah lain) pada Nasional · Negeri + Swasta.");
  });

  it("pembanding belum cukup: satu kalimat info yang menyebut jumlah sekolah dan ambangnya, tanpa angka pembanding", () => {
    const w = susunWawasan(laporan(jawaban), susunPembanding({ filter: FILTER_WILAYAH_KOSONG, indikator: [], sekolah: [sekolahAgregat(70, "sendiri")], schoolIdSendiri: "sendiri" }));
    expect(w[0]).toMatchObject({ jenis: "info" });
    expect(w[0]!.teks).toBe("Pembanding Nasional · Negeri + Swasta belum tersedia: baru 1 sekolah pengguna AyoTKA yang punya data pada mapel ini (minimal 3). Coba cakupan yang lebih luas, misalnya provinsi atau nasional.");
    expect(cari(w, /^Posisi sekolah/)).toBeUndefined();
  });

  it("sekolah di luar cakupan yang dipilih: pembanding ada, posisi tidak ada", () => {
    const w = susunWawasan(laporan(jawaban), pembandingCukup([50, 60, 70], "bukan-saya"));
    expect(cari(w, /rerata pengguna AyoTKA/)).toBeDefined();
    expect(cari(w, /^Posisi sekolah/)).toBeUndefined();
  });

  it("kalimat pembanding selalu paling depan", () => {
    const w = susunWawasan(laporan(jawaban), pembandingCukup([70, 50, 40]));
    expect(w[0]!.teks).toMatch(/rerata pengguna AyoTKA/);
  });
});

describe("susunWawasan - kelompok terkuat dan terlemah", () => {
  it("menyebut elemen terkuat dan terlemah (Matematika: label Elemen)", () => {
    const w = susunWawasan(laporan([...kelas(mat(1), 10, 9), ...kelas(mat(3), 10, 3)]));
    expect(cari(w, /^Elemen terkuat/)!.teks).toBe("Elemen terkuat: Bilangan (90%). Elemen yang paling perlu diperkuat: Aljabar (30%). Gunakan elemen ini sebagai arah remedial.");
  });

  it("Bahasa Indonesia memakai label Kompetensi (tidak pernah 'Elemen')", () => {
    const w = susunWawasan(laporan([...kelas(bin(1), 10, 9), ...kelas(bin(3), 10, 3)]));
    const k = cari(w, /terkuat/)!;
    expect(k.teks).toContain("Kompetensi terkuat: Pemahaman Tekstual");
    expect(teks(w).join(" ")).not.toMatch(/Elemen|elemen/);
  });

  it("selisih di bawah 5 poin: tidak disebut", () => {
    const w = susunWawasan(laporan([...kelas(mat(1), 100, 62), ...kelas(mat(3), 100, 60)]));
    expect(cari(w, /terkuat/)).toBeUndefined();
  });

  it("hanya satu kelompok: tidak disebut", () => {
    expect(cari(susunWawasan(laporan(kelas(mat(1), 10, 5))), /terkuat/)).toBeUndefined();
  });
});

describe("susunWawasan - rerata nasional resmi", () => {
  it("kelompok di bawah rerata nasional: perhatian, menyebut nama; indikator terjauh disebut dengan selisihnya", () => {
    const w = susunWawasan(laporan([...kelas(mat(1, { nilaiNasional: 40 }), 10, 8), ...kelas(mat(3, { nilaiNasional: 80 }), 10, 2)]));
    const k = cari(w, /di bawah rerata nasional resmi: /)!;
    expect(k).toMatchObject({ jenis: "perhatian" });
    expect(k.teks).toBe("1 dari 2 elemen di bawah rerata nasional resmi: Aljabar.");
    expect(cari(w, /indikator di bawah rerata nasional/)!.teks).toBe(
      '1 indikator di bawah rerata nasional resmi. Selisih terbesar: "Indikator mat 3 (3)" (20% vs nasional 80%, -60,0 poin).',
    );
  });

  it("semua di atas nasional: kalimat positif", () => {
    const w = susunWawasan(laporan([...kelas(mat(1, { nilaiNasional: 40 }), 10, 8), ...kelas(mat(3, { nilaiNasional: 30 }), 10, 7)]));
    expect(cari(w, /di atas rerata nasional resmi/)).toMatchObject({ jenis: "positif" });
    expect(cari(w, /tidak ada yang tertinggal/)).toBeDefined();
  });

  it("kelompok dengan data belum cukup (kurang dari 3 soal) tidak ikut dibandingkan", () => {
    const w = susunWawasan(laporan([...kelas(mat(1, { nilaiNasional: 90 }), 2, 0), ...kelas(mat(3), 10, 5)]));
    expect(cari(w, /rerata nasional resmi/)).toBeUndefined();
  });

  it("tanpa rerata nasional sama sekali: tidak ada kalimat nasional", () => {
    expect(cari(susunWawasan(laporan(kelas(mat(1), 10, 5))), /nasional resmi/)).toBeUndefined();
  });
});

describe("susunWawasan - siswa perlu remedial", () => {
  it("siswa di bawah 50%: jumlah, persentase, dan indikator awal remedial", () => {
    // 10 siswa: 4 menjawab semua salah (0%), 6 semua benar -> 4 dari 10 di bawah 50%
    const i = mat(1);
    const jawaban = [...Array.from({ length: 4 }, (_, k) => jw(i, 0, { studentId: `x${k}` })), ...Array.from({ length: 6 }, (_, k) => jw(i, 1, { studentId: `y${k}` }))];
    const w = susunWawasan(laporan(jawaban));
    const k = cari(w, /perlu remedial/)!;
    expect(k.jenis).toBe("perhatian");
    expect(k.teks).toContain("4 dari 10 siswa (40%) berdaya serap di bawah 50%");
  });

  it("indikator awal remedial disebut bila cukup bukti (minimal 5 jawaban dan di bawah 70%)", () => {
    const w = susunWawasan(laporan([...kelas(mat(1), 10, 2)]));
    expect(cari(w, /perlu remedial/)!.teks).toContain('Mulai dari indikator: "Indikator mat 1 (1)" (20%).');
  });

  it("tidak ada siswa di bawah 50%: positif", () => {
    const w = susunWawasan(laporan(kelas(mat(1), 10, 10)));
    expect(cari(w, /Tidak ada siswa/)).toMatchObject({ jenis: "positif" });
    expect(cari(w, /Tidak ada siswa/)!.teks).toContain("10 siswa dihitung");
  });
});

describe("susunWawasan - tren bulanan", () => {
  const bulan = (periode: string, n: number, benar: number) => kelas(mat(1), n, benar, { bulan: periode });

  it("naik: positif, menyebut kedua bulan dan besar kenaikan", () => {
    const w = susunWawasan(laporan([...bulan("2026-09", MIN_JAWABAN_TREN, 10), ...bulan("2026-10", MIN_JAWABAN_TREN, 16)]));
    expect(cari(w, /^Daya serap naik/)).toMatchObject({ jenis: "positif" });
    expect(cari(w, /^Daya serap naik/)!.teks).toBe("Daya serap naik 30,0 poin dari Sep 2026 ke Okt 2026 (50% ke 80%).");
  });

  it("turun: perhatian", () => {
    const w = susunWawasan(laporan([...bulan("2026-09", 20, 16), ...bulan("2026-10", 20, 10)]));
    expect(cari(w, /^Daya serap turun/)).toMatchObject({ jenis: "perhatian" });
    expect(cari(w, /^Daya serap turun/)!.teks).toBe("Daya serap turun 30,0 poin dari Sep 2026 ke Okt 2026 (80% ke 50%).");
  });

  it("selisih di bawah 3 poin: stabil (info)", () => {
    const w = susunWawasan(laporan([...bulan("2026-09", 100, 50), ...bulan("2026-10", 100, 52)]));
    expect(cari(w, /^Daya serap stabil/)).toMatchObject({ jenis: "info" });
  });

  it("hanya dua bulan TERAKHIR yang dibandingkan, walau ada bulan lebih awal", () => {
    const w = susunWawasan(laporan([...bulan("2026-08", 20, 2), ...bulan("2026-09", 20, 10), ...bulan("2026-10", 20, 10)]));
    expect(cari(w, /^Daya serap stabil/)!.teks).toContain("Sep 2026 ke Okt 2026");
  });

  it("bulan dengan jawaban terlalu sedikit tidak dipakai menyimpulkan tren", () => {
    const w = susunWawasan(laporan([...bulan("2026-09", MIN_JAWABAN_TREN, 10), ...bulan("2026-10", MIN_JAWABAN_TREN - 1, 19)]));
    expect(cari(w, /^Daya serap (naik|turun|stabil)/)).toBeUndefined();
  });

  it("satu bulan saja: tidak ada kalimat tren", () => {
    expect(cari(susunWawasan(laporan(bulan("2026-10", 30, 15))), /^Daya serap (naik|turun|stabil)/)).toBeUndefined();
  });
});

describe("susunWawasan - level kognitif", () => {
  const level = (l: string, n: number, benar: number) => kelas(mat(1), n, benar, { level: l });

  it("menyebut level terlemah dan terkuat bila selisih bermakna", () => {
    const w = susunWawasan(laporan([...level("L1", 20, 18), ...level("L2", 20, 12), ...level("L3", 20, 6)]));
    expect(cari(w, /level kognitif/)!.teks).toBe(
      "Berdasarkan level kognitif, Level 3 (Penalaran) paling lemah (30%) dan Level 1 (Pengetahuan & Pemahaman) paling kuat (90%). Latihan terarah pada level terlemah akan paling membantu.",
    );
  });

  it("selisih kurang dari 10 poin: tidak disebut", () => {
    expect(cari(susunWawasan(laporan([...level("L1", 20, 12), ...level("L3", 20, 11)])), /level kognitif/)).toBeUndefined();
  });

  it("level dengan jawaban terlalu sedikit diabaikan; butuh minimal dua level yang cukup", () => {
    const w = susunWawasan(laporan([...level("L1", MIN_JAWABAN_LEVEL, 10), ...level("L3", MIN_JAWABAN_LEVEL - 1, 0)]));
    expect(cari(w, /level kognitif/)).toBeUndefined();
  });
});

describe("susunWawasan - cakupan indikator resmi", () => {
  it("di bawah separuh jawaban tertaut: diberi tahu", () => {
    const w = susunWawasan(laporan([...kelas(mat(1), 4, 2), ...kelas(null, 8, 4)]));
    expect(cari(w, /tertaut ke indikator resmi/)!.teks).toBe("Baru 33% jawaban (4 dari 12) yang tertaut ke indikator resmi, jadi laporan ini belum mewakili seluruh hasil ujian.");
  });

  it("separuh atau lebih tertaut: tidak disebut", () => {
    expect(cari(susunWawasan(laporan([...kelas(mat(1), 5, 2), ...kelas(null, 5, 2)])), /tertaut/)).toBeUndefined();
  });
});

describe("susunWawasan - sifat umum", () => {
  const data = () => [...kelas(mat(1, { nilaiNasional: 50 }), 20, 18, { bulan: "2026-09", level: "L1" }), ...kelas(mat(3, { nilaiNasional: 50 }), 20, 4, { bulan: "2026-10", level: "L3" })];

  it("deterministik: data sama menghasilkan wawasan yang sama persis", () => {
    const p = pembandingCukup([60, 50, 70]);
    expect(susunWawasan(laporan(data()), p)).toEqual(susunWawasan(laporan(data()), p));
  });

  it("urutan: pembanding, kelompok, nasional, siswa, tren, level", () => {
    const urutan = susunWawasan(laporan(data()), pembandingCukup([55, 50, 70])).map((x) => x.teks.split(" ").slice(0, 2).join(" "));
    const posisi = (awal: string) => urutan.findIndex((t) => t.startsWith(awal));
    expect(posisi("Daya serap")).toBeLessThan(posisi("Elemen terkuat:")); // pembanding dulu
    expect(posisi("Elemen terkuat:")).toBeLessThan(posisi("1 dari"));
  });

  it("jenis hanya perhatian/info/positif dan teks tidak pernah kosong atau memuat NaN/undefined", () => {
    for (const w of susunWawasan(laporan(data()), pembandingCukup([55, 50, 70]))) {
      expect(["perhatian", "info", "positif"]).toContain(w.jenis);
      expect(w.teks.length).toBeGreaterThan(10);
      expect(w.teks).not.toMatch(/NaN|undefined|null|Infinity/);
    }
  });
});
