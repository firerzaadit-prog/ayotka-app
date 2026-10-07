import { describe, expect, it } from "vitest";
import { susunRekapBersama, type AttemptRekap, type PesertaRekap } from "@/lib/exam/rekap-bersama";

const peserta = (id: string, nama: string, nisn: string | null = null, claim: PesertaRekap["claimStatus"] = "sudah_klaim"): PesertaRekap => ({
  studentId: id,
  nama,
  nisn,
  claimStatus: claim,
});

let urut = 0;
const attempt = (studentId: string, status: AttemptRekap["status"], skor: number | null, menit = 30, mulai = "2026-10-08T01:00:00.000Z", tab = 0): AttemptRekap => {
  const m = new Date(mulai);
  return {
    id: `a${++urut}`,
    studentId,
    status,
    skorAkhir: skor,
    mulaiAt: m,
    selesaiAt: status === "selesai" || status === "kedaluwarsa" ? new Date(m.getTime() + menit * 60_000) : null,
    tabSwitchCount: tab,
  };
};

describe("susunRekapBersama - peringkat", () => {
  it("nilai tertinggi peringkat 1; nilai kembar berbagi peringkat dan peringkat berikutnya melompat (1,2,2,4)", () => {
    const p = [peserta("s1", "Dina"), peserta("s2", "Eko"), peserta("s3", "Fajar"), peserta("s4", "Gita")];
    const a = [attempt("s1", "selesai", 80), attempt("s2", "selesai", 90), attempt("s3", "selesai", 80), attempt("s4", "selesai", 70)];
    const { baris } = susunRekapBersama(p, a);
    expect(baris.map((b) => [b.nama, b.peringkat])).toEqual([
      ["Eko", 1],
      ["Dina", 2],
      ["Fajar", 2],
      ["Gita", 4],
    ]);
  });

  it("nilai sama: yang lebih cepat tampil di atas tetapi peringkatnya tetap sama", () => {
    const p = [peserta("s1", "Anto"), peserta("s2", "Bayu")];
    const a = [attempt("s1", "selesai", 85, 50), attempt("s2", "selesai", 85, 20)];
    const { baris } = susunRekapBersama(p, a);
    expect(baris.map((b) => b.nama)).toEqual(["Bayu", "Anto"]);
    expect(baris.map((b) => b.peringkat)).toEqual([1, 1]);
  });

  it("nilai sama dan durasi sama: urut nama (tanpa memperhatikan huruf besar/kecil)", () => {
    const p = [peserta("s1", "budi"), peserta("s2", "Adi"), peserta("s3", "Citra")];
    const a = [attempt("s1", "selesai", 60, 10), attempt("s2", "selesai", 60, 10), attempt("s3", "selesai", 60, 10)];
    expect(susunRekapBersama(p, a).baris.map((b) => b.nama)).toEqual(["Adi", "budi", "Citra"]);
  });

  it("waktu habis juga diberi nilai dan peringkat, dengan status 'waktu_habis'", () => {
    const p = [peserta("s1", "Dina"), peserta("s2", "Eko")];
    const a = [attempt("s1", "kedaluwarsa", 40), attempt("s2", "selesai", 60)];
    const { baris } = susunRekapBersama(p, a);
    expect(baris.map((b) => [b.nama, b.status, b.skor, b.peringkat])).toEqual([
      ["Eko", "selesai", 60, 1],
      ["Dina", "waktu_habis", 40, 2],
    ]);
  });

  it("nilai 0 tetap punya peringkat (0 bukan 'tidak ada nilai')", () => {
    const p = [peserta("s1", "Dina"), peserta("s2", "Eko")];
    const a = [attempt("s1", "selesai", 0), attempt("s2", "selesai", 10)];
    const { baris, statistik } = susunRekapBersama(p, a);
    expect(baris.map((b) => [b.nama, b.peringkat])).toEqual([["Eko", 1], ["Dina", 2]]);
    expect(statistik.terendah).toBe(0);
    expect(statistik.jumlahBernilai).toBe(2);
  });
});

describe("susunRekapBersama - percobaan resmi = yang pertama", () => {
  it("percobaan ulang yang nilainya lebih tinggi TIDAK menggantikan nilai pertama", () => {
    const p = [peserta("s1", "Dina")];
    const pertama = attempt("s1", "selesai", 40, 30, "2026-10-08T01:00:00.000Z");
    const kedua = attempt("s1", "selesai", 95, 30, "2026-10-08T03:00:00.000Z");
    const { baris, statistik } = susunRekapBersama(p, [kedua, pertama]); // urutan masukan dibalik sengaja
    expect(baris[0]).toMatchObject({ skor: 40, attemptId: pertama.id, jumlahPercobaan: 2 });
    expect(statistik.rataRata).toBe(40);
  });

  it("SEMUA percobaan tercatat di `percobaan` (tidak ada yang disembunyikan): nomor, penanda resmi, nilai, durasi, dan urutan waktu", () => {
    const p = [peserta("s1", "Dina")];
    const ketiga = attempt("s1", "selesai", 70, 20, "2026-10-08T05:00:00.000Z", 1);
    const pertama = attempt("s1", "kedaluwarsa", 40, 60, "2026-10-08T01:00:00.000Z");
    const kedua = attempt("s1", "selesai", 95, 30, "2026-10-08T03:00:00.000Z", 2);
    const { baris } = susunRekapBersama(p, [ketiga, pertama, kedua]); // urutan masukan acak sengaja
    const b = baris[0]!;
    expect(b.jumlahPercobaan).toBe(3);
    expect(b.percobaan.map((x) => [x.nomor, x.resmi, x.status, x.skor, x.durasiMenit, x.tabSwitchCount])).toEqual([
      [1, true, "waktu_habis", 40, 60, 0],
      [2, false, "selesai", 95, 30, 2],
      [3, false, "selesai", 70, 20, 1],
    ]);
    expect(b.percobaan.map((x) => x.attemptId)).toEqual([pertama.id, kedua.id, ketiga.id]);
    // Nilai resmi dan peringkat tetap dari percobaan PERTAMA walau percobaan lain lebih tinggi.
    expect([b.skor, b.peringkat, b.attemptId]).toEqual([40, 1, pertama.id]);
  });

  it("percobaan yang masih berjalan ikut tercatat tanpa nilai/durasi; siswa yang belum mulai punya daftar kosong", () => {
    const p = [peserta("s1", "Dina"), peserta("s2", "Eko")];
    const selesai = attempt("s1", "selesai", 80, 30, "2026-10-08T01:00:00.000Z");
    const berjalan = attempt("s1", "berjalan", 55, 30, "2026-10-08T03:00:00.000Z");
    const { baris } = susunRekapBersama(p, [selesai, berjalan]);
    expect(baris.find((x) => x.nama === "Dina")!.percobaan.map((x) => [x.nomor, x.status, x.skor, x.durasiMenit])).toEqual([
      [1, "selesai", 80, 30],
      [2, "mengerjakan", null, null],
    ]);
    expect(baris.find((x) => x.nama === "Eko")!.percobaan).toEqual([]);
  });

  it("percobaan pertama yang masih berjalan = belum bernilai, walau ada percobaan lain", () => {
    const p = [peserta("s1", "Dina")];
    const a = [attempt("s1", "berjalan", null, 30, "2026-10-08T01:00:00.000Z"), attempt("s1", "selesai", 90, 30, "2026-10-08T05:00:00.000Z")];
    const { baris, statistik } = susunRekapBersama(p, a);
    expect(baris[0]).toMatchObject({ status: "mengerjakan", skor: null, peringkat: null, jumlahPercobaan: 2 });
    expect(statistik.jumlahBernilai).toBe(0);
  });

  it("percobaan yang BELUM berakhir tidak pernah bernilai, walau barisnya membawa nilai sementara (tidak diranking, tidak masuk statistik)", () => {
    const p = [peserta("s1", "Dina"), peserta("s2", "Eko"), peserta("s3", "Fajar")];
    const a = [attempt("s1", "berjalan", 55), attempt("s2", "paused", 90), attempt("s3", "selesai", 70)];
    const { baris, statistik } = susunRekapBersama(p, a);
    expect(baris.map((b) => [b.nama, b.skor, b.peringkat])).toEqual([
      ["Fajar", 70, 1],
      ["Dina", null, null],
      ["Eko", null, null],
    ]);
    expect(statistik).toMatchObject({ jumlahBernilai: 1, rataRata: 70, tertinggi: 70, terendah: 70 });
  });

  it("attempt milik siswa yang bukan peserta diabaikan", () => {
    const p = [peserta("s1", "Dina")];
    const a = [attempt("s1", "selesai", 70), attempt("orang-lain", "selesai", 100)];
    const { baris, statistik } = susunRekapBersama(p, a);
    expect(baris).toHaveLength(1);
    expect(statistik.rataRata).toBe(70);
    expect(statistik.tertinggi).toBe(70);
  });
});

describe("susunRekapBersama - status dan urutan", () => {
  const p = [
    peserta("s1", "Dina", "001"),
    peserta("s2", "Eko", "002"),
    peserta("s3", "Fajar", "003"),
    peserta("s4", "Gita", "004"),
    peserta("s5", "Hana", "005", "belum_klaim"),
    peserta("s6", "Indra", "006"),
  ];
  const a = [
    attempt("s1", "selesai", 75, 40, undefined, 3),
    attempt("s2", "berjalan", null),
    attempt("s3", "paused", null),
    attempt("s4", "kedaluwarsa", 30),
  ];

  it("urutan: yang bernilai (peringkat), lalu yang sedang/dijeda, lalu yang belum mulai", () => {
    const { baris } = susunRekapBersama(p, a);
    expect(baris.map((b) => b.nama)).toEqual(["Dina", "Gita", "Eko", "Fajar", "Hana", "Indra"]);
    expect(baris.map((b) => b.status)).toEqual(["selesai", "waktu_habis", "mengerjakan", "dijeda", "belum", "belum"]);
  });

  it("yang belum mulai dan yang sedang mengerjakan masing-masing diurutkan menurut nama, walau masukan tidak berurutan", () => {
    const acak = [
      peserta("b3", "Zahra"),
      peserta("b1", "Citra"),
      peserta("m2", "Yuni"),
      peserta("b2", "Anto"),
      peserta("m1", "Budi"),
    ];
    const { baris } = susunRekapBersama(acak, [attempt("m1", "berjalan", null), attempt("m2", "paused", null)]);
    expect(baris.map((b) => b.nama)).toEqual(["Budi", "Yuni", "Anto", "Citra", "Zahra"]);
  });

  it("siswa yang belum mulai tidak punya attemptId, nilai, peringkat, atau durasi", () => {
    const { baris } = susunRekapBersama(p, a);
    expect(baris.find((b) => b.nama === "Hana")).toMatchObject({
      attemptId: null,
      skor: null,
      peringkat: null,
      durasiMenit: null,
      jumlahPercobaan: 0,
      claimStatus: "belum_klaim",
    });
  });

  it("durasi (menit) dan jumlah pindah tab diambil dari percobaan resmi", () => {
    const { baris } = susunRekapBersama(p, a);
    expect(baris.find((b) => b.nama === "Dina")).toMatchObject({ durasiMenit: 40, tabSwitchCount: 3 });
  });

  it("selesai tanpa nilai (data cacat) tidak masuk statistik dan tidak diberi peringkat, tetapi tetap tampil", () => {
    const { baris, statistik } = susunRekapBersama([peserta("s1", "Dina"), peserta("s2", "Eko")], [attempt("s1", "selesai", null), attempt("s2", "selesai", 50)]);
    expect(baris.map((b) => [b.nama, b.peringkat])).toEqual([["Eko", 1], ["Dina", null]]);
    expect(statistik.jumlahBernilai).toBe(1);
    expect(statistik.jumlahSelesai).toBe(2);
  });
});

describe("susunRekapBersama - statistik", () => {
  const p = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"].map((id, i) => peserta(id, `Siswa ${i + 1}`));

  it("hitungan peserta, selesai, sedang, belum, dan partisipasi", () => {
    const a = [attempt("s1", "selesai", 80), attempt("s2", "kedaluwarsa", 60), attempt("s3", "berjalan", null), attempt("s4", "paused", null)];
    const { statistik } = susunRekapBersama(p, a);
    expect(statistik).toMatchObject({
      jumlahPeserta: 7,
      jumlahSelesai: 2,
      jumlahSedang: 2,
      jumlahBelum: 3,
      partisipasiPersen: 57,
      jumlahBernilai: 2,
    });
  });

  it("rata-rata dibulatkan satu desimal; tertinggi, terendah, median (ganjil)", () => {
    const a = [attempt("s1", "selesai", 70), attempt("s2", "selesai", 75), attempt("s3", "selesai", 76)];
    const { statistik } = susunRekapBersama(p, a);
    expect(statistik.rataRata).toBe(73.7);
    expect(statistik.tertinggi).toBe(76);
    expect(statistik.terendah).toBe(70);
    expect(statistik.median).toBe(75);
  });

  it("median untuk jumlah genap = rata-rata dua nilai tengah", () => {
    const a = [attempt("s1", "selesai", 50), attempt("s2", "selesai", 60), attempt("s3", "selesai", 80), attempt("s4", "selesai", 90)];
    expect(susunRekapBersama(p, a).statistik.median).toBe(70);
  });

  it("sebaran nilai: batas bawah termasuk, 100 masuk kelompok terakhir, nilai di luar rentang dijepit", () => {
    const skor = [0, 19.9, 20, 39, 40, 59.9, 60, 79, 80, 99.9, 100, 105, -3];
    const peserta13 = skor.map((_, i) => peserta(`x${i}`, `X${i}`));
    const a = skor.map((s, i) => attempt(`x${i}`, "selesai", s));
    const { statistik } = susunRekapBersama(peserta13, a);
    expect(statistik.sebaran.map((s) => s.jumlah)).toEqual([3, 2, 2, 2, 4]);
    expect(statistik.sebaran.map((s) => s.label)).toEqual(["0 – 20", "20 – 40", "40 – 60", "60 – 80", "80 – 100"]);
    expect(statistik.sebaran.reduce((n, s) => n + s.jumlah, 0)).toBe(skor.length);
  });

  it("tanpa peserta: semua nol / null dan tidak ada galat pembagian nol", () => {
    const { baris, statistik } = susunRekapBersama([], []);
    expect(baris).toEqual([]);
    expect(statistik).toMatchObject({ jumlahPeserta: 0, partisipasiPersen: 0, rataRata: null, tertinggi: null, terendah: null, median: null });
    expect(statistik.sebaran.every((s) => s.jumlah === 0)).toBe(true);
  });

  it("peserta ada tetapi belum ada yang mengerjakan: nilai null, partisipasi 0", () => {
    const { statistik } = susunRekapBersama(p, []);
    expect(statistik).toMatchObject({ jumlahPeserta: 7, jumlahBelum: 7, partisipasiPersen: 0, rataRata: null, median: null });
  });
});
