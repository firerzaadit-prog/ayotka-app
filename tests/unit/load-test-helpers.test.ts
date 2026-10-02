import { describe, expect, it } from "vitest";
import {
  adalahNamaUjiBeban,
  adalahNisnUjiBeban,
  BATAS_JUMLAH_MAKS,
  buatNisn,
  buatSandi,
  emailDariNisn,
  buatKontenSoal,
  formatUntukNomor,
  hostDatabase,
  namaSiswa,
  parseJumlah,
  pastikanKonfirmasiTujuan,
  refProyekDariDatabase,
  refProyekDariSupabaseUrl,
  SOAL_AWALAN,
} from "../../scripts/load-test/helpers";

describe("buatNisn", () => {
  it("10 digit angka berawalan 9, unik per nomor", () => {
    expect(buatNisn(1)).toBe("9000000001");
    expect(buatNisn(5000)).toBe("9000005000");
    expect(buatNisn(1)).toHaveLength(10);
    expect(new Set(Array.from({ length: 2000 }, (_, i) => buatNisn(i + 1))).size).toBe(2000);
  });

  it("selalu cocok dengan pola login NISN (^\\d{10}$) dan penanda uji beban", () => {
    for (const n of [1, 99, 10_000, 99_999_999]) {
      expect(buatNisn(n)).toMatch(/^\d{10}$/);
      expect(adalahNisnUjiBeban(buatNisn(n))).toBe(true);
    }
  });

  it("menolak nomor di luar jangkauan", () => {
    for (const n of [0, -1, 1.5, 100_000_000]) expect(() => buatNisn(n)).toThrow();
  });

  it("email mengikuti konvensi aplikasi", () => {
    expect(emailDariNisn("9000000001")).toBe("9000000001@nisn.ayotka.id");
  });
});

describe("penanda akun uji beban (pengaman hapus)", () => {
  it("NISN asli (bukan berawalan 9 / bukan 10 digit) tidak dianggap akun uji", () => {
    for (const nisn of ["0123456789", "1234567890", "900000001", "90000000011", "", null, undefined, "9abcdefghi"]) {
      expect(adalahNisnUjiBeban(nisn as string | null | undefined)).toBe(false);
    }
  });

  it("nama harus berawalan 'Load Test Siswa '", () => {
    expect(adalahNamaUjiBeban(namaSiswa(7))).toBe(true);
    for (const nama of ["Budi Santoso", "Load Test", "load test siswa 1", "Load Test Siswa", "", null]) {
      expect(adalahNamaUjiBeban(nama as string | null)).toBe(false);
    }
  });
});

describe("parseJumlah", () => {
  it("bawaan 100; angka valid dipakai; di luar 1..maks atau bukan bilangan bulat -> galat", () => {
    expect(parseJumlah(undefined)).toBe(100);
    expect(parseJumlah("")).toBe(100);
    expect(parseJumlah("5000")).toBe(5000);
    expect(parseJumlah(String(BATAS_JUMLAH_MAKS))).toBe(BATAS_JUMLAH_MAKS);
    for (const v of ["0", "-3", "1.5", "abc", String(BATAS_JUMLAH_MAKS + 1)]) {
      expect(() => parseJumlah(v)).toThrow();
    }
  });
});

describe("pengaman konfirmasi proyek tujuan", () => {
  const REF_UJI = "abcdefghij1234567890";
  const REF_PROD = "pyqeqhvouysotijhkhdg";
  const POOLER = (ref: string) => `postgresql://postgres.${ref}:rahasia@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;
  const SUPA = (ref: string) => `https://${ref}.supabase.co`;

  it("hostDatabase tidak membawa kata sandi dan menolak url tidak valid", () => {
    expect(hostDatabase(POOLER(REF_UJI))).toBe("aws-0-ap-southeast-1.pooler.supabase.com");
    expect(() => hostDatabase(undefined)).toThrow();
    expect(() => hostDatabase("bukan-url")).toThrow();
  });

  it("ID proyek dibaca dari pengguna pooler, host langsung, dan URL Supabase", () => {
    expect(refProyekDariDatabase(POOLER(REF_UJI))).toBe(REF_UJI);
    expect(refProyekDariDatabase(`postgresql://postgres:x@db.${REF_UJI}.supabase.co:5432/postgres`)).toBe(REF_UJI);
    expect(refProyekDariDatabase("postgresql://postgres:x@localhost:5432/postgres")).toBeNull();
    expect(refProyekDariSupabaseUrl(SUPA(REF_UJI))).toBe(REF_UJI);
    expect(refProyekDariSupabaseUrl("http://127.0.0.1:54321")).toBeNull();
    expect(refProyekDariDatabase(undefined)).toBeNull();
  });

  it("host pooler SAMA untuk semua proyek, jadi yang dikonfirmasi adalah ID proyek (bukan host)", () => {
    expect(hostDatabase(POOLER(REF_UJI))).toBe(hostDatabase(POOLER(REF_PROD)));
    // Mengetik host saja tidak cukup untuk membedakan uji dari production:
    expect(() => pastikanKonfirmasiTujuan(POOLER(REF_PROD), SUPA(REF_PROD), "aws-0-ap-southeast-1.pooler.supabase.com")).toThrow(/Dibatalkan/);
  });

  it("tanpa konfirmasi / konfirmasi salah -> dibatalkan, pesan menyebut proyek tujuan dan perintah yang benar", () => {
    expect(() => pastikanKonfirmasiTujuan(POOLER(REF_UJI), SUPA(REF_UJI), undefined)).toThrow(new RegExp(REF_UJI));
    expect(() => pastikanKonfirmasiTujuan(POOLER(REF_UJI), SUPA(REF_UJI), REF_PROD)).toThrow(/LOAD_TEST_CONFIRM_PROJECT/);
  });

  it("konfirmasi persis sama dengan ID proyek -> lanjut", () => {
    expect(pastikanKonfirmasiTujuan(POOLER(REF_UJI), SUPA(REF_UJI), REF_UJI)).toBe(REF_UJI);
    expect(pastikanKonfirmasiTujuan(POOLER(REF_UJI), SUPA(REF_UJI), ` ${REF_UJI} `)).toBe(REF_UJI);
  });

  it("database dan Supabase Auth menunjuk proyek BERBEDA -> dibatalkan walau konfirmasi benar", () => {
    expect(() => pastikanKonfirmasiTujuan(POOLER(REF_UJI), SUPA(REF_PROD), REF_UJI)).toThrow(/harus proyek yang sama/);
    expect(() => pastikanKonfirmasiTujuan(POOLER(REF_PROD), SUPA(REF_UJI), REF_PROD)).toThrow(/harus proyek yang sama/);
  });

  it("database lokal (non-Supabase): yang dikonfirmasi nama host", () => {
    const lokal = "postgresql://postgres:x@localhost:5432/postgres";
    expect(pastikanKonfirmasiTujuan(lokal, undefined, "localhost")).toBe("localhost");
    expect(() => pastikanKonfirmasiTujuan(lokal, undefined, undefined)).toThrow(/localhost/);
  });
});

describe("buatKontenSoal (paket soal uji beban)", () => {
  let n = 0;
  const uuid = () => `id-${++n}`;

  it("menghasilkan jumlah soal yang diminta dengan campuran 60% PG, 20% PG Kompleks, 20% PG Kategori", () => {
    n = 0;
    const k = buatKontenSoal(30, uuid);
    expect(k.questions).toHaveLength(30);
    const hitung = (f: string) => k.questions.filter((q) => q.format === f).length;
    expect(hitung("pg")).toBe(18);
    expect(hitung("pg_kompleks")).toBe(6);
    expect(hitung("pg_kategori")).toBe(6);
    expect(formatUntukNomor(5)).toBe("pg_kategori");
    expect(formatUntukNomor(4)).toBe("pg_kompleks");
    expect(formatUntukNomor(1)).toBe("pg");
  });

  it("aturan tiap format sama dengan validasi soal aplikasi", () => {
    n = 0;
    const k = buatKontenSoal(40, uuid);
    for (const q of k.questions) {
      const opsi = k.options.filter((o) => o.questionId === q.id);
      const kunci = opsi.filter((o) => o.isCorrect).length;
      if (q.format === "pg") {
        expect(opsi).toHaveLength(4);
        expect(kunci).toBe(1);
      } else if (q.format === "pg_kompleks") {
        expect(opsi).toHaveLength(4);
        expect(kunci).toBe(2);
      } else {
        const kategori = k.categories.filter((c) => c.questionId === q.id);
        const pernyataan = k.statements.filter((s) => s.questionId === q.id);
        expect(kategori.map((c) => c.label)).toEqual(["Benar", "Salah"]);
        expect(pernyataan.length).toBeGreaterThanOrEqual(1);
        expect(pernyataan.length).toBeLessThanOrEqual(3);
        for (const s of pernyataan) expect(kategori.some((c) => c.id === s.correctCategoryId)).toBe(true);
        expect(opsi).toHaveLength(0);
      }
    }
  });

  it("semua id unik, tiap opsi/kategori/pernyataan menunjuk soal yang ada, dan teks diberi penanda uji beban", () => {
    n = 0;
    const k = buatKontenSoal(25, uuid);
    const idSoal = new Set(k.questions.map((q) => q.id));
    const semuaId = [...k.questions.map((q) => q.id), ...k.categories.map((c) => c.id)];
    expect(new Set(semuaId).size).toBe(semuaId.length);
    for (const x of [...k.options, ...k.categories, ...k.statements]) expect(idSoal.has(x.questionId)).toBe(true);
    for (const q of k.questions) expect(q.teks.startsWith(SOAL_AWALAN)).toBe(true);
    expect(k.questions.every((q) => q.bobot === 1)).toBe(true);
  });

  it("kesulitan dan level kognitif memakai nilai enum yang sah", () => {
    n = 0;
    const k = buatKontenSoal(12, uuid);
    for (const q of k.questions) {
      expect(["mudah", "sedang", "sulit"]).toContain(q.tingkatKesulitan);
      expect(["L1", "L2", "L3"]).toContain(q.levelBloom);
    }
  });

  it("jumlah di luar 1-200 atau bukan bilangan bulat ditolak", () => {
    for (const j of [0, -1, 201, 1.5]) expect(() => buatKontenSoal(j, uuid)).toThrow();
  });
});

describe("buatSandi", () => {
  it("panjang sesuai dan hanya karakter yang aman dibaca", () => {
    let i = 0;
    const sandi = buatSandi(16, (maks) => i++ % maks);
    expect(sandi).toHaveLength(16);
    expect(sandi).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
  });
});
