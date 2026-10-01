import { describe, expect, it } from "vitest";
import {
  adalahNamaUjiBeban,
  adalahNisnUjiBeban,
  BATAS_JUMLAH_MAKS,
  buatNisn,
  buatSandi,
  emailDariNisn,
  hostDatabase,
  namaSiswa,
  parseJumlah,
  pastikanKonfirmasiHost,
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

describe("pengaman konfirmasi host database", () => {
  const URL_DB = "postgresql://user:rahasia@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

  it("hostDatabase tidak membawa kata sandi", () => {
    expect(hostDatabase(URL_DB)).toBe("aws-0-ap-southeast-1.pooler.supabase.com");
    expect(() => hostDatabase(undefined)).toThrow();
    expect(() => hostDatabase("bukan-url")).toThrow();
  });

  it("tanpa konfirmasi / konfirmasi salah -> dibatalkan, pesan menyebut host tujuan", () => {
    expect(() => pastikanKonfirmasiHost(URL_DB, undefined)).toThrow(/aws-0-ap-southeast-1\.pooler\.supabase\.com/);
    expect(() => pastikanKonfirmasiHost(URL_DB, "localhost")).toThrow(/Dibatalkan/);
  });

  it("konfirmasi persis sama dengan host -> lanjut", () => {
    expect(pastikanKonfirmasiHost(URL_DB, "aws-0-ap-southeast-1.pooler.supabase.com")).toBe(
      "aws-0-ap-southeast-1.pooler.supabase.com",
    );
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
