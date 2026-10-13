import { describe, expect, it } from "vitest";
import {
  ambilHalaman,
  berikanPeringkat,
  daftarPilihan,
  hitungPerJenis,
  ringkasHasil,
  saringHasil,
  susunDaftarPaket,
  susunDetailPaket,
  susunHasilTryOut,
  susunPeringkatSiswa,
  susunSebaran,
  urutkanHasil,
  type HasilTryOut,
  type PaketInfo,
  type PercobaanMentah,
  type SiswaInfo,
} from "@/lib/hasil-tryout/susun";

const t = (iso: string) => new Date(iso);

const siswa = (id: string, nama: string, o: Partial<SiswaInfo> = {}): SiswaInfo => ({ id, nama, nisn: null, claimStatus: "sudah_klaim", lulusAt: null, ...o });
const paket = (id: string, nama: string, o: Partial<PaketInfo> = {}): PaketInfo => ({
  id,
  nama,
  kategori: "mandiri",
  ownerType: "pusat",
  jenjang: "SD",
  subjectId: "m1",
  mapel: "Matematika",
  ...o,
});
const perc = (id: string, studentId: string, packageId: string, o: Partial<PercobaanMentah> = {}): PercobaanMentah => ({
  id,
  studentId,
  packageId,
  assignmentId: null,
  status: "selesai",
  skorAkhir: 80,
  mulaiAt: t("2026-10-01T01:00:00Z"),
  selesaiAt: t("2026-10-01T01:30:00Z"),
  ...o,
});
const peta = <T extends { id: string }>(daftar: T[]) => new Map(daftar.map((x) => [x.id, x]));

/** Hasil siap pakai untuk uji penyaringan/ringkasan, dibangun lewat susunHasilTryOut. */
function hasilContoh(): HasilTryOut[] {
  const s = peta([
    siswa("s1", "Ani", { nisn: "1001" }),
    siswa("s2", "Budi", { nisn: "1002" }),
    siswa("s3", "Citra", { nisn: "1003", lulusAt: t("2026-06-30T00:00:00Z") }),
  ]);
  const p = peta([
    paket("p1", "Paket 1", { subjectId: "m1", mapel: "Matematika" }),
    paket("p2", "Paket 2", { subjectId: "m2", mapel: "Bahasa Indonesia" }),
    paket("pn", "Nasional 1", { kategori: "nasional", subjectId: "m1", mapel: "Matematika" }),
  ]);
  return susunHasilTryOut(
    [
      perc("a1", "s1", "p1", { skorAkhir: 90, mulaiAt: t("2026-10-01T01:00:00Z") }), // mandiri
      perc("a2", "s1", "p2", { skorAkhir: 70, mulaiAt: t("2026-10-05T01:00:00Z"), assignmentId: "pen1" }), // sekolah
      perc("a3", "s2", "p1", { skorAkhir: 60, mulaiAt: t("2026-10-02T01:00:00Z") }), // mandiri
      perc("a4", "s2", "pn", { skorAkhir: 85, mulaiAt: t("2026-10-10T01:00:00Z") }), // nasional
      perc("a5", "s3", "p1", { skorAkhir: 50, mulaiAt: t("2026-09-01T01:00:00Z") }), // alumni
    ],
    s,
    p,
  );
}

describe("susunHasilTryOut: hasil resmi = percobaan pertama yang selesai", () => {
  const s = peta([siswa("s1", "Ani"), siswa("s2", "Budi")]);
  const p = peta([paket("p1", "Paket 1"), paket("p2", "Paket 2", { subjectId: "m2", mapel: "Bahasa Indonesia" })]);

  it("percobaan ulang tidak mengubah nilai resmi: yang paling awal dipakai", () => {
    const h = susunHasilTryOut(
      [
        perc("kedua", "s1", "p1", { skorAkhir: 95, mulaiAt: t("2026-10-03T01:00:00Z") }),
        perc("pertama", "s1", "p1", { skorAkhir: 40, mulaiAt: t("2026-10-01T01:00:00Z") }),
        perc("ketiga", "s1", "p1", { skorAkhir: 100, mulaiAt: t("2026-10-05T01:00:00Z") }),
      ],
      s,
      p,
    );
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ attemptId: "pertama", skor: 40, studentId: "s1", packageId: "p1" });
  });

  it("percobaan yang masih berjalan atau dijeda tidak dihitung; yang pertama SELESAI-lah yang resmi", () => {
    const h = susunHasilTryOut(
      [
        perc("ditinggal", "s1", "p1", { status: "berjalan", skorAkhir: null, selesaiAt: null, mulaiAt: t("2026-10-01T01:00:00Z") }),
        perc("dijeda", "s2", "p1", { status: "paused", skorAkhir: null, selesaiAt: null }),
        perc("selesai", "s1", "p1", { skorAkhir: 77, mulaiAt: t("2026-10-02T01:00:00Z") }),
      ],
      s,
      p,
    );
    expect(h.map((x) => x.attemptId)).toEqual(["selesai"]);
  });

  it("waktu habis (kedaluwarsa) ikut dihitung dan tercatat statusnya", () => {
    const h = susunHasilTryOut([perc("habis", "s1", "p1", { status: "kedaluwarsa", skorAkhir: 30 })], s, p);
    expect(h[0]).toMatchObject({ status: "kedaluwarsa", skor: 30 });
  });

  it("jalur berbeda = try out berbeda: pilih-sendiri dan tiap penugasan masing-masing punya hasil resmi", () => {
    const h = susunHasilTryOut(
      [
        perc("mandiri", "s1", "p1", { skorAkhir: 50, mulaiAt: t("2026-10-01T01:00:00Z") }),
        perc("tugas-a", "s1", "p1", { skorAkhir: 80, assignmentId: "A", mulaiAt: t("2026-10-10T01:00:00Z") }),
        perc("tugas-b", "s1", "p1", { skorAkhir: 90, assignmentId: "B", mulaiAt: t("2026-10-20T01:00:00Z") }),
        perc("tugas-a-ulang", "s1", "p1", { skorAkhir: 99, assignmentId: "A", mulaiAt: t("2026-10-11T01:00:00Z") }),
      ],
      s,
      p,
    );
    expect(h.map((x) => `${x.attemptId}:${x.jenis}`).sort()).toEqual(["mandiri:mandiri", "tugas-a:sekolah", "tugas-b:sekolah"]);
  });

  it("jenis: nasional > sekolah (penugasan) > mandiri", () => {
    const pn = peta([paket("pn", "Nas", { kategori: "nasional" }), paket("p1", "Paket 1")]);
    const h = susunHasilTryOut(
      [perc("n", "s1", "pn", { assignmentId: "X" }), perc("s", "s1", "p1", { assignmentId: "X" }), perc("m", "s2", "p1")],
      s,
      pn,
    );
    expect(Object.fromEntries(h.map((x) => [x.attemptId, x.jenis]))).toEqual({ n: "nasional", s: "sekolah", m: "mandiri" });
  });

  it("waktu mulai kembar: id terkecil menang (hasil tetap sama berapa pun urutan masukan)", () => {
    const sama = t("2026-10-01T01:00:00Z");
    const a = susunHasilTryOut([perc("b", "s1", "p1", { mulaiAt: sama, skorAkhir: 1 }), perc("a", "s1", "p1", { mulaiAt: sama, skorAkhir: 2 })], s, p);
    const b = susunHasilTryOut([perc("a", "s1", "p1", { mulaiAt: sama, skorAkhir: 2 }), perc("b", "s1", "p1", { mulaiAt: sama, skorAkhir: 1 })], s, p);
    expect(a[0]!.attemptId).toBe("a");
    expect(b[0]!.attemptId).toBe("a");
  });

  it("durasi dalam menit (dibulatkan), kosong bila belum ada waktu selesai; alumni dan status klaim terbawa", () => {
    const sw = peta([siswa("s1", "Ani", { lulusAt: t("2026-06-30T00:00:00Z"), claimStatus: "belum_klaim" })]);
    const h = susunHasilTryOut(
      [
        perc("x", "s1", "p1", { mulaiAt: t("2026-10-01T01:00:00Z"), selesaiAt: t("2026-10-01T01:34:40Z") }),
        perc("y", "s1", "p2", { mulaiAt: t("2026-10-01T01:00:00Z"), selesaiAt: null }),
      ],
      sw,
      p,
    );
    const x = h.find((r) => r.attemptId === "x")!;
    expect(x).toMatchObject({ durasiMenit: 35, alumni: true, claimStatus: "belum_klaim" });
    expect(h.find((r) => r.attemptId === "y")!.durasiMenit).toBeNull();
  });

  it("siswa atau paket yang tidak dikenal dilewati; nilai kosong tetap tercatat sebagai hasil", () => {
    const h = susunHasilTryOut([perc("tak-ada-siswa", "zzz", "p1"), perc("tak-ada-paket", "s1", "zzz"), perc("tanpa-nilai", "s1", "p2", { skorAkhir: null })], s, p);
    expect(h.map((x) => x.attemptId)).toEqual(["tanpa-nilai"]);
    expect(h[0]!.skor).toBeNull();
  });
});

describe("saringHasil", () => {
  const h = hasilContoh();
  const id = (daftar: HasilTryOut[]) => daftar.map((x) => x.attemptId).sort();

  it("tanpa syarat = semua; jenis menyaring tepat", () => {
    expect(id(saringHasil(h, {}))).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    expect(id(saringHasil(h, { jenis: "semua" }))).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    expect(id(saringHasil(h, { jenis: "mandiri" }))).toEqual(["a1", "a3", "a5"]);
    expect(id(saringHasil(h, { jenis: "sekolah" }))).toEqual(["a2"]);
    expect(id(saringHasil(h, { jenis: "nasional" }))).toEqual(["a4"]);
  });

  it("mata pelajaran dan paket", () => {
    expect(id(saringHasil(h, { mapelId: "m2" }))).toEqual(["a2"]);
    expect(id(saringHasil(h, { paketId: "p1" }))).toEqual(["a1", "a3", "a5"]);
    expect(id(saringHasil(h, { paketId: "p1", jenis: "sekolah" }))).toEqual([]);
  });

  it("rentang tanggal memakai waktu mulai dan sama-sama inklusif", () => {
    expect(id(saringHasil(h, { dari: t("2026-10-02T01:00:00Z"), sampai: t("2026-10-05T01:00:00Z") }))).toEqual(["a2", "a3"]);
    expect(id(saringHasil(h, { dari: t("2026-10-05T01:00:01Z") }))).toEqual(["a4"]);
    expect(id(saringHasil(h, { sampai: t("2026-09-30T00:00:00Z") }))).toEqual(["a5"]);
  });

  it("alumni dapat dikeluarkan; bawaan ikut", () => {
    expect(id(saringHasil(h, { alumni: "tanpa" }))).toEqual(["a1", "a2", "a3", "a4"]);
    expect(id(saringHasil(h, { alumni: "ikut" }))).toEqual(["a1", "a2", "a3", "a4", "a5"]);
  });

  it("pencarian nama atau NISN: potongan, tanpa membedakan huruf, spasi berlebih dirapikan", () => {
    expect(id(saringHasil(h, { cari: "ani" }))).toEqual(["a1", "a2"]);
    expect(id(saringHasil(h, { cari: "  BUDI  " }))).toEqual(["a3", "a4"]);
    expect(id(saringHasil(h, { cari: "1003" }))).toEqual(["a5"]);
    expect(id(saringHasil(h, { cari: "100" }))).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    expect(id(saringHasil(h, { cari: "tidak ada" }))).toEqual([]);
    expect(id(saringHasil(h, { cari: "   " }))).toEqual(["a1", "a2", "a3", "a4", "a5"]);
  });

  it("syarat digabung (dan)", () => {
    expect(id(saringHasil(h, { jenis: "mandiri", alumni: "tanpa", cari: "budi" }))).toEqual(["a3"]);
  });
});

describe("urutkanHasil dan ambilHalaman", () => {
  const h = hasilContoh();
  const id = (daftar: HasilTryOut[]) => daftar.map((x) => x.attemptId);

  it("terbaru, nilai tertinggi, nilai terendah, nama", () => {
    expect(id(urutkanHasil(h, "terbaru"))).toEqual(["a4", "a2", "a3", "a1", "a5"]);
    expect(id(urutkanHasil(h, "nilai_tertinggi"))).toEqual(["a1", "a4", "a2", "a3", "a5"]);
    expect(id(urutkanHasil(h, "nilai_terendah"))).toEqual(["a5", "a3", "a2", "a4", "a1"]);
    expect(id(urutkanHasil(h, "nama"))).toEqual(["a2", "a1", "a4", "a3", "a5"]);
  });

  it("nilai kosong selalu di akhir untuk kedua arah nilai; masukan asli tidak diubah", () => {
    const tanpa: HasilTryOut = { ...h[0]!, attemptId: "kosong", skor: null, mulaiAt: t("2026-10-30T01:00:00Z") };
    const campur = [tanpa, ...h];
    const asli = campur.map((x) => x.attemptId);
    expect(id(urutkanHasil(campur, "nilai_tertinggi")).at(-1)).toBe("kosong");
    expect(id(urutkanHasil(campur, "nilai_terendah")).at(-1)).toBe("kosong");
    expect(campur.map((x) => x.attemptId)).toEqual(asli);
  });

  it("nilai yang sama pada satu desimal dianggap seri dan diurutkan terbaru dulu", () => {
    const a: HasilTryOut = { ...h[0]!, attemptId: "lama", skor: 80.04, mulaiAt: t("2026-10-01T01:00:00Z") };
    const b: HasilTryOut = { ...h[0]!, attemptId: "baru", skor: 80.0, mulaiAt: t("2026-10-09T01:00:00Z") };
    expect(id(urutkanHasil([a, b], "nilai_tertinggi"))).toEqual(["baru", "lama"]);
  });

  it("halaman dipotong dan nomor halaman dirapatkan ke rentang yang ada", () => {
    const daftar = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(ambilHalaman(daftar, 1, 10)).toMatchObject({ baris: daftar.slice(0, 10), halaman: 1, total: 25, totalHalaman: 3, ukuran: 10 });
    expect(ambilHalaman(daftar, 3, 10).baris).toEqual([21, 22, 23, 24, 25]);
    expect(ambilHalaman(daftar, 99, 10).halaman).toBe(3);
    expect(ambilHalaman(daftar, 0, 10).halaman).toBe(1);
    expect(ambilHalaman(daftar, -4, 10).halaman).toBe(1);
    expect(ambilHalaman(daftar, Number.NaN, 10).halaman).toBe(1);
    expect(ambilHalaman([], 1, 10)).toMatchObject({ baris: [], halaman: 1, total: 0, totalHalaman: 1 });
    expect(ambilHalaman(daftar, 1, 0).ukuran).toBe(1);
  });
});

describe("hitungPerJenis, ringkasHasil, daftarPilihan", () => {
  const h = hasilContoh();

  it("jumlah per jenis; semua = seluruhnya", () => {
    expect(hitungPerJenis(h)).toEqual({ semua: 5, mandiri: 3, sekolah: 1, nasional: 1 });
    expect(hitungPerJenis([])).toEqual({ semua: 0, mandiri: 0, sekolah: 0, nasional: 0 });
  });

  it("ringkasan: jumlah hasil, siswa berbeda, rata-rata satu desimal (nilai kosong tidak dihitung)", () => {
    expect(ringkasHasil(h)).toEqual({ jumlahHasil: 5, jumlahSiswa: 3, rataRata: 71 });
    expect(ringkasHasil([])).toEqual({ jumlahHasil: 0, jumlahSiswa: 0, rataRata: null });
    expect(ringkasHasil([{ ...h[0]!, skor: null }])).toEqual({ jumlahHasil: 1, jumlahSiswa: 1, rataRata: null });
  });

  it("pilihan mapel dan paket tanpa duplikat, urut nama, lengkap dengan jenis yang ada pada paket", () => {
    const pilihan = daftarPilihan(h);
    expect(pilihan.mapel).toEqual([
      { id: "m2", nama: "Bahasa Indonesia" },
      { id: "m1", nama: "Matematika" },
    ]);
    expect(pilihan.paket.map((p) => p.nama)).toEqual(["Nasional 1", "Paket 1", "Paket 2"]);
    expect(pilihan.paket.find((p) => p.id === "p2")).toMatchObject({ mapelId: "m2", jenis: ["sekolah"] });
    expect(pilihan.paket.find((p) => p.id === "p1")!.jenis).toEqual(["mandiri"]);
  });
});

describe("berikanPeringkat", () => {
  it("gaya olahraga: seri berbagi peringkat dan peringkat berikutnya melompat", () => {
    expect(berikanPeringkat([100, 90, 90, 80, 80, 80, 70], (n) => n)).toEqual([1, 2, 2, 4, 4, 4, 7]);
    expect(berikanPeringkat([], (n: number) => n)).toEqual([]);
    expect(berikanPeringkat([50], (n) => n)).toEqual([1]);
  });

  it("seri dinilai pada satu desimal (yang tampil), bukan angka mentahnya", () => {
    expect(berikanPeringkat([85.04, 85.0, 84.9], (n) => n)).toEqual([1, 1, 3]);
    expect(berikanPeringkat([85.06, 85.04], (n) => n)).toEqual([1, 2]);
  });
});

describe("susunPeringkatSiswa", () => {
  it("rata-rata nilai try out, tertinggi ke terendah; alumni dan jumlah per jenis terbawa", () => {
    const baris = susunPeringkatSiswa(hasilContoh());
    expect(baris.map((b) => [b.peringkat, b.nama, b.rataRata, b.jumlahTryOut])).toEqual([
      [1, "Ani", 80, 2],
      [2, "Budi", 72.5, 2],
      [3, "Citra", 50, 1],
    ]);
    const ani = baris[0]!;
    expect(ani).toMatchObject({ tertinggi: 90, terendah: 70, perJenis: { mandiri: 1, sekolah: 1, nasional: 0 }, alumni: false });
    expect(ani.terakhirAt).toEqual(t("2026-10-05T01:00:00Z"));
    expect(baris[2]!.alumni).toBe(true);
  });

  it("nilai kosong tidak ikut rata-rata dan siswa tanpa satu pun nilai tidak masuk peringkat", () => {
    const h = hasilContoh().map((x) => (x.attemptId === "a1" ? { ...x, skor: null } : x));
    const baris = susunPeringkatSiswa(h);
    expect(baris.find((b) => b.nama === "Ani")).toMatchObject({ rataRata: 70, jumlahTryOut: 1 });
    const semuaKosong = susunPeringkatSiswa(h.filter((x) => x.studentId === "s1").map((x) => ({ ...x, skor: null })));
    expect(semuaKosong).toEqual([]);
  });

  it("seri pada rata-rata satu desimal berbagi peringkat; di dalam seri lebih banyak try out dulu, lalu nama", () => {
    const dasar = hasilContoh()[0]!;
    const buat = (studentId: string, nama: string, skor: number[]): HasilTryOut[] =>
      skor.map((s, i) => ({ ...dasar, attemptId: `${studentId}-${i}`, studentId, nama, packageId: `p${i}`, skor: s }));
    const h = [...buat("x1", "Zeta", [80, 80]), ...buat("x2", "Alfa", [80]), ...buat("x3", "Beta", [80.04, 79.98]), ...buat("x4", "Gama", [60])];
    const baris = susunPeringkatSiswa(h);
    // Zeta (2 try out) dan Beta (2 try out, rata-rata 80,01 ≈ 80,0) lebih dulu daripada Alfa (1 try out); semuanya seri
    expect(baris.map((b) => [b.peringkat, b.nama])).toEqual([
      [1, "Beta"],
      [1, "Zeta"],
      [1, "Alfa"],
      [4, "Gama"],
    ]);
  });

  it("minimal try out menyaring siswa yang try out-nya masih sedikit", () => {
    const h = hasilContoh();
    expect(susunPeringkatSiswa(h, 2).map((b) => b.nama)).toEqual(["Ani", "Budi"]);
    expect(susunPeringkatSiswa(h, 3)).toEqual([]);
    expect(susunPeringkatSiswa(h, 0).map((b) => b.nama)).toEqual(["Ani", "Budi", "Citra"]);
  });

  it("tanpa hasil = daftar kosong", () => {
    expect(susunPeringkatSiswa([])).toEqual([]);
  });
});

describe("susunDaftarPaket", () => {
  const aktif = { SD: 10, SMP: 5 };

  it("paket dengan siswa terbanyak di atas; siswa berbeda, alumni dipisah, partisipasi dari siswa aktif sejenjang", () => {
    const daftar = susunDaftarPaket(hasilContoh(), aktif);
    expect(daftar.map((b) => b.nama)).toEqual(["Paket 1", "Nasional 1", "Paket 2"]);
    const p1 = daftar[0]!;
    expect(p1).toMatchObject({
      packageId: "p1",
      jumlahHasil: 3,
      jumlahSiswa: 3,
      jumlahSiswaAktif: 2,
      siswaAktifJenjang: 10,
      partisipasiPersen: 20,
      rataRata: 66.7,
      tertinggi: 90,
      terendah: 50,
      perJenis: { mandiri: 3, sekolah: 0, nasional: 0 },
    });
    expect(p1.terakhirAt).toEqual(t("2026-10-02T01:00:00Z"));
  });

  it("jenis dihitung per hasil: paket pusat yang sebagian dikerjakan mandiri dan sebagian lewat penugasan", () => {
    const dasar = hasilContoh()[0]!;
    const h: HasilTryOut[] = [
      { ...dasar, attemptId: "1", studentId: "a", jenis: "mandiri" },
      { ...dasar, attemptId: "2", studentId: "b", jenis: "sekolah" },
      { ...dasar, attemptId: "3", studentId: "c", jenis: "sekolah" },
    ];
    expect(susunDaftarPaket(h, aktif)[0]!.perJenis).toEqual({ mandiri: 1, sekolah: 2, nasional: 0 });
  });

  it("siswa yang punya dua hasil pada paket yang sama (dua jenis) dihitung sekali sebagai siswa", () => {
    const dasar = hasilContoh()[0]!;
    const h: HasilTryOut[] = [
      { ...dasar, attemptId: "1", studentId: "a", jenis: "mandiri" },
      { ...dasar, attemptId: "2", studentId: "a", jenis: "sekolah" },
    ];
    const p = susunDaftarPaket(h, aktif)[0]!;
    expect(p).toMatchObject({ jumlahHasil: 2, jumlahSiswa: 1, jumlahSiswaAktif: 1 });
  });

  it("partisipasi tidak pernah lebih dari 100% dan null bila tak ada siswa aktif sejenjang", () => {
    const dasar = hasilContoh()[0]!;
    const h = ["a", "b", "c"].map((s, i): HasilTryOut => ({ ...dasar, attemptId: String(i), studentId: s }));
    expect(susunDaftarPaket(h, { SD: 2 })[0]!.partisipasiPersen).toBe(100);
    expect(susunDaftarPaket(h, {})[0]!.partisipasiPersen).toBeNull();
  });

  it("urutan lain: rata-rata (kosong di akhir), terbaru, nama; seri pada 'terbanyak' ikut jumlah hasil lalu terbaru", () => {
    const h = hasilContoh();
    expect(susunDaftarPaket(h, aktif, "rata_rata").map((b) => b.nama)).toEqual(["Nasional 1", "Paket 2", "Paket 1"]);
    expect(susunDaftarPaket(h, aktif, "terbaru").map((b) => b.nama)).toEqual(["Nasional 1", "Paket 2", "Paket 1"]);
    expect(susunDaftarPaket(h, aktif, "nama").map((b) => b.nama)).toEqual(["Nasional 1", "Paket 1", "Paket 2"]);
    const tanpaNilai = h.map((x) => (x.packageId === "p2" ? { ...x, skor: null } : x));
    expect(susunDaftarPaket(tanpaNilai, aktif, "rata_rata").map((b) => b.nama).at(-1)).toBe("Paket 2");
    expect(susunDaftarPaket(tanpaNilai, aktif, "rata_rata").at(-1)).toMatchObject({ rataRata: null, tertinggi: null, terendah: null });
    // Nasional 1 dan Paket 2 sama-sama satu siswa dan satu hasil: yang terakhir dikerjakan (Nasional 1) lebih dulu
    expect(susunDaftarPaket(h, aktif, "terbanyak").map((b) => b.nama)).toEqual(["Paket 1", "Nasional 1", "Paket 2"]);
  });

  it("tanpa hasil = daftar kosong", () => {
    expect(susunDaftarPaket([], aktif)).toEqual([]);
  });
});

describe("susunDetailPaket: sudah/belum mengerjakan dan peringkat", () => {
  const dasar = hasilContoh()[0]!;
  const hasil = (id: string, studentId: string, nama: string, skor: number | null, o: Partial<HasilTryOut> = {}): HasilTryOut => ({
    ...dasar,
    attemptId: id,
    studentId,
    nama,
    skor,
    durasiMenit: 30,
    alumni: false,
    ...o,
  });
  const aktifSemua: SiswaInfo[] = [
    siswa("s1", "Ani"),
    siswa("s2", "Budi"),
    siswa("s3", "Citra"),
    siswa("s4", "Dewi", { claimStatus: "belum_klaim" }),
    siswa("s5", "Eka"),
    siswa("s6", "Fajar"),
  ];

  it("peringkat nilai tertinggi ke terendah, seri berbagi peringkat (yang lebih cepat tampil dulu); belum mengerjakan terpisah", () => {
    const d = susunDetailPaket({
      hasilPaket: [
        hasil("h1", "s1", "Ani", 90, { durasiMenit: 40 }),
        hasil("h2", "s2", "Budi", 90, { durasiMenit: 20 }),
        hasil("h3", "s3", "Citra", 70),
      ],
      siswaAktif: aktifSemua,
      sedangMengerjakan: new Set(["s5"]),
    });
    expect(d.hasil.map((h) => [h.peringkat, h.nama])).toEqual([
      [1, "Budi"],
      [1, "Ani"],
      [3, "Citra"],
    ]);
    expect(d.belum.map((b) => [b.nama, b.status])).toEqual([
      ["Eka", "sedang_mengerjakan"],
      ["Dewi", "belum_mulai"],
      ["Fajar", "belum_mulai"],
    ]);
    expect(d.belum.find((b) => b.nama === "Dewi")!.claimStatus).toBe("belum_klaim");
  });

  it("statistik: partisipasi dari siswa aktif, rata-rata, median, tertinggi, terendah, sebaran", () => {
    const d = susunDetailPaket({
      hasilPaket: [hasil("h1", "s1", "Ani", 90), hasil("h2", "s2", "Budi", 60), hasil("h3", "s3", "Citra", 75)],
      siswaAktif: aktifSemua,
      sedangMengerjakan: new Set(["s5"]),
    });
    expect(d.statistik).toMatchObject({
      siswaAktif: 6,
      sudahMengerjakan: 3,
      sudahMengerjakanAktif: 3,
      belumMengerjakan: 3,
      sedangMengerjakan: 1,
      partisipasiPersen: 50,
      jumlahBernilai: 3,
      rataRata: 75,
      median: 75,
      tertinggi: 90,
      terendah: 60,
    });
    // 60 dan 75 masuk rentang 60 – 80, 90 masuk 80 – 100
    expect(d.statistik.sebaran.map((s) => s.jumlah)).toEqual([0, 0, 0, 2, 1]);
  });

  it("alumni yang sudah mengerjakan ikut peringkat tetapi tidak menambah 'siswa aktif' dan tidak muncul di 'belum'", () => {
    const d = susunDetailPaket({
      hasilPaket: [hasil("h1", "s1", "Ani", 90), hasil("hx", "alumni-1", "Alumni Lama", 95, { alumni: true })],
      siswaAktif: [...aktifSemua, siswa("alumni-2", "Alumni Belum", { lulusAt: t("2026-06-30T00:00:00Z") })],
      sedangMengerjakan: new Set(),
    });
    expect(d.hasil[0]).toMatchObject({ nama: "Alumni Lama", peringkat: 1, alumni: true });
    // partisipasi dihitung dari siswa AKTIF saja: 1 dari 6 = 17% (alumni yang sudah mengerjakan tidak menaikkannya)
    expect(d.statistik).toMatchObject({ siswaAktif: 6, sudahMengerjakan: 2, sudahMengerjakanAktif: 1, belumMengerjakan: 5, partisipasiPersen: 17 });
    expect(d.belum.map((b) => b.nama)).not.toContain("Alumni Belum");
  });

  it("siswa yang mengerjakan dua kali lewat dua jalur muncul sekali sebagai 'sudah mengerjakan' tetapi dua baris di peringkat", () => {
    const d = susunDetailPaket({
      hasilPaket: [hasil("h1", "s1", "Ani", 90, { jenis: "mandiri" }), hasil("h2", "s1", "Ani", 70, { jenis: "sekolah" })],
      siswaAktif: aktifSemua,
      sedangMengerjakan: new Set(),
    });
    expect(d.statistik.sudahMengerjakan).toBe(1);
    expect(d.hasil).toHaveLength(2);
    expect(d.belum.map((b) => b.nama)).not.toContain("Ani");
  });

  it("hasil tanpa nilai tampil di akhir tanpa peringkat dan tidak ikut statistik nilai", () => {
    const d = susunDetailPaket({
      hasilPaket: [hasil("h1", "s1", "Ani", null), hasil("h2", "s2", "Budi", 80)],
      siswaAktif: aktifSemua,
      sedangMengerjakan: new Set(),
    });
    expect(d.hasil.map((h) => [h.nama, h.peringkat])).toEqual([["Budi", 1], ["Ani", null]]);
    expect(d.statistik).toMatchObject({ jumlahBernilai: 1, rataRata: 80, sudahMengerjakan: 2 });
  });

  it("paket belum dikerjakan siapa pun: semua siswa aktif ada di 'belum'; statistik kosong tanpa NaN", () => {
    const d = susunDetailPaket({ hasilPaket: [], siswaAktif: aktifSemua, sedangMengerjakan: new Set() });
    expect(d.hasil).toEqual([]);
    expect(d.belum).toHaveLength(6);
    expect(d.statistik).toMatchObject({ partisipasiPersen: 0, rataRata: null, median: null, tertinggi: null, terendah: null, jumlahBernilai: 0 });
    expect(JSON.stringify(d.statistik)).not.toMatch(/NaN|null,"sebaran":null/);
  });

  it("tanpa siswa aktif: partisipasi 0% (bukan pembagian dengan nol)", () => {
    const d = susunDetailPaket({ hasilPaket: [hasil("h1", "s1", "Ani", 90)], siswaAktif: [], sedangMengerjakan: new Set() });
    expect(d.statistik.partisipasiPersen).toBe(0);
    expect(d.statistik.siswaAktif).toBe(0);
  });

  it("median untuk jumlah genap = rata-rata dua nilai tengah", () => {
    const d = susunDetailPaket({
      hasilPaket: [hasil("h1", "s1", "Ani", 60), hasil("h2", "s2", "Budi", 70), hasil("h3", "s3", "Citra", 80), hasil("h4", "s4", "Dewi", 100)],
      siswaAktif: aktifSemua,
      sedangMengerjakan: new Set(),
    });
    expect(d.statistik.median).toBe(75);
  });
});

describe("susunSebaran", () => {
  it("lima rentang 20 poin; 100 masuk rentang terakhir; di luar rentang dirapatkan", () => {
    expect(susunSebaran([0, 19.9, 20, 39, 40, 59, 60, 79, 80, 99, 100]).map((s) => s.jumlah)).toEqual([2, 2, 2, 2, 3]);
    expect(susunSebaran([-5, 150]).map((s) => s.jumlah)).toEqual([1, 0, 0, 0, 1]);
    expect(susunSebaran([]).map((s) => s.label)).toEqual(["0 – 20", "20 – 40", "40 – 60", "60 – 80", "80 – 100"]);
  });
});
