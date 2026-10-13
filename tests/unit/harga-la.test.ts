import { describe, expect, it } from "vitest";
import {
  KONFIG_HARGA_LA_BAWAAN,
  LANGKAH_HARGA_LA,
  contohHargaLA,
  hitungHargaLA,
  perbaikiKonfigHargaLA,
  rentangHargaLA,
  validasiKonfigHargaLA,
  type KonfigHargaLA,
} from "@/lib/billing/harga-la";

const K = KONFIG_HARGA_LA_BAWAAN;
/** Pengaturan uji dengan skala mudah dihitung: harga naik tepat Rp1 per token di antara 1.000 dan 4.000 token. */
const KT: KonfigHargaLA = { hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 1_000, bebanBerat: 4_000 };

describe("nilai bawaan", () => {
  it("rentang Rp4.500 sampai Rp7.500, beban ringan 6.500 token, beban berat 13.500 token", () => {
    expect(K).toEqual({ hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 });
    expect(LANGKAH_HARGA_LA).toBe(500);
  });
});

describe("hitungHargaLA", () => {
  it("beban ringan (sampai batas ringan) = harga minimum; beban berat (dari batas berat) = harga maksimum", () => {
    for (const n of [0, 1, 500, 6_000, 6_500]) expect(hitungHargaLA(n), `n=${n}`).toBe(4_500);
    for (const n of [13_500, 13_501, 20_000, 500_000, 100_000_000]) expect(hitungHargaLA(n), `n=${n}`).toBe(7_500);
  });

  it("pengaturan bawaan: titik tengah 10.000 token = Rp6.000, naik lurus di antaranya", () => {
    expect(hitungHargaLA(10_000)).toBe(6_000);
    expect(hitungHargaLA(8_250)).toBe(5_500); // 5.250 -> tepat di tengah, dibulatkan ke atas
    expect(hitungHargaLA(11_750)).toBe(7_000); // 6.750 -> tepat di tengah, dibulatkan ke atas
    expect(hitungHargaLA(7_000)).toBe(4_500); // 4.571
    expect(hitungHargaLA(7_500)).toBe(5_000); // 4.929
  });

  it("di antaranya naik lurus (Rp1 per token pada skala uji) dan dibulatkan ke Rp500 terdekat (tabel acuan)", () => {
    // harga mentah = 4.500 + (beban - 1.000); kolom kanan = hasil pembulatan ke Rp500 terdekat
    const tabel: Array<[number, number]> = [
      [1_100, 4_500], // 4.600
      [1_200, 4_500], // 4.700
      [1_300, 5_000], // 4.800
      [1_500, 5_000], // 5.000
      [1_800, 5_500], // 5.300
      [2_000, 5_500], // 5.500
      [2_300, 6_000], // 5.800
      [2_500, 6_000], // 6.000
      [3_000, 6_500], // 6.500
      [3_500, 7_000], // 7.000
      [3_900, 7_500], // 7.400
    ];
    for (const [n, harga] of tabel) expect(hitungHargaLA(n, KT), `n=${n}`).toBe(harga);
  });

  it("tepat di tengah dua kelipatan dibulatkan ke atas", () => {
    // harga mentah: beban 1.200 = 5.250, 1.600 = 5.500, 1.800 = 5.750
    const k = { hargaMin: 5_000, hargaMaks: 6_000, bebanRingan: 1_000, bebanBerat: 2_000 };
    expect(hitungHargaLA(1_500, k)).toBe(5_500); // 5.500
    expect(hitungHargaLA(1_250, k)).toBe(5_500); // 5.250
    expect(hitungHargaLA(1_249, k)).toBe(5_000); // 5.249
    expect(hitungHargaLA(1_750, k)).toBe(6_000); // 5.750
    expect(hitungHargaLA(1_749, k)).toBe(5_500); // 5.749
  });

  it("beban tidak sah (NaN, negatif, tak hingga) dibaca 0: harga minimum, tidak pernah galat atau NaN", () => {
    for (const n of [Number.NaN, -5, -1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]) {
      expect(hitungHargaLA(n), String(n)).toBe(4_500);
    }
  });

  it("beban desimal dipotong ke bawah (bukan dibulatkan ke atas atau ke terdekat)", () => {
    expect(hitungHargaLA(2_999.9, KT)).toBe(hitungHargaLA(2_999, KT));
    expect(hitungHargaLA(3_000.1, KT)).toBe(hitungHargaLA(3_000, KT));
    // Titik lompatan ke kelipatan Rp500 berikutnya: 1.249 = 4.749 -> 4.500 tetapi 1.250 = 4.750 -> 5.000; 1.749 -> 5.000 tetapi 1.750 -> 5.500.
    // Pecahan di bawah lompatan harus ikut yang bawah; pembulatan ke atas atau ke terdekat akan melompat.
    expect(hitungHargaLA(1_249, KT)).toBe(4_500);
    expect(hitungHargaLA(1_250, KT)).toBe(5_000);
    expect(hitungHargaLA(1_249.1, KT)).toBe(4_500);
    expect(hitungHargaLA(1_249.9, KT)).toBe(4_500);
    expect(hitungHargaLA(1_749, KT)).toBe(5_000);
    expect(hitungHargaLA(1_750, KT)).toBe(5_500);
    expect(hitungHargaLA(1_749.5, KT)).toBe(5_000);
    expect(hitungHargaLA(1_749.99, KT)).toBe(5_000);
  });

  it("SELALU di antara minimum dan maksimum, tidak pernah turun saat beban bertambah (diuji pada banyak pengaturan)", () => {
    const daftar: KonfigHargaLA[] = [
      K,
      { hargaMin: 4_300, hargaMaks: 7_200, bebanRingan: 1_000, bebanBerat: 3_000 },
      // pembulatan ke Rp500 bisa melewati ujung bila ujungnya bukan kelipatan Rp500: harus dijaga
      { hargaMin: 4_300, hargaMaks: 7_300, bebanRingan: 1_000, bebanBerat: 3_000 },
      { hargaMin: 4_700, hargaMaks: 7_300, bebanRingan: 1_000, bebanBerat: 3_000 },
      { hargaMin: 500, hargaMaks: 500, bebanRingan: 100, bebanBerat: 200 },
      { hargaMin: 1_000, hargaMaks: 100_000, bebanRingan: 300, bebanBerat: 40_000 },
      { hargaMin: 5_000, hargaMaks: 5_000, bebanRingan: 2_000, bebanBerat: 5_000 },
      { hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 100, bebanBerat: 100_000 },
      // rentang sempit pada beban besar: harga mentah nyaris tidak bergerak, jadi pembulatan ke Rp500 melewati ujung di kedua sisi
      { hargaMin: 4_600, hargaMaks: 4_700, bebanRingan: 100, bebanBerat: 100_000 },
      { hargaMin: 4_800, hargaMaks: 4_900, bebanRingan: 100, bebanBerat: 100_000 },
    ];
    for (const k of daftar) {
      let sebelumnya = -1;
      for (let n = 0; n <= 130_000; n += 83) {
        const harga = hitungHargaLA(n, k);
        expect(harga, `${JSON.stringify(k)} n=${n}`).toBeGreaterThanOrEqual(k.hargaMin);
        expect(harga, `${JSON.stringify(k)} n=${n}`).toBeLessThanOrEqual(k.hargaMaks);
        expect(harga, `${JSON.stringify(k)} n=${n}`).toBeGreaterThanOrEqual(sebelumnya);
        expect(Number.isInteger(harga)).toBe(true);
        sebelumnya = harga;
      }
    }
  });

  it("pembulatan ke Rp500 ditahan di minimum dan maksimum yang bukan kelipatan Rp500", () => {
    // beban 101 = 4.600,0 -> dibulatkan 4.500 (di bawah minimum) -> ditahan di 4.600
    const bawah = { hargaMin: 4_600, hargaMaks: 4_700, bebanRingan: 100, bebanBerat: 100_000 };
    expect(hitungHargaLA(101, bawah)).toBe(4_600);
    expect(hitungHargaLA(100, bawah)).toBe(4_600);
    // beban 99.999 = 4.899,9 -> dibulatkan 5.000 (di atas maksimum) -> ditahan di 4.900
    const atas = { hargaMin: 4_800, hargaMaks: 4_900, bebanRingan: 100, bebanBerat: 100_000 };
    expect(hitungHargaLA(99_999, atas)).toBe(4_900);
    expect(hitungHargaLA(100_000, atas)).toBe(4_900);
  });

  it("harga di antara ujung selalu kelipatan Rp500 bila minimum dan maksimum kelipatan Rp500", () => {
    for (let n = K.bebanRingan + 1; n < K.bebanBerat; n += 7) expect(hitungHargaLA(n) % LANGKAH_HARGA_LA, `n=${n}`).toBe(0);
  });

  it("ujungnya tepat harga minimum/maksimum walau bukan kelipatan Rp500 (tidak dibulatkan)", () => {
    const k = { hargaMin: 4_300, hargaMaks: 7_200, bebanRingan: 1_000, bebanBerat: 3_000 };
    expect(hitungHargaLA(1_000, k)).toBe(4_300);
    expect(hitungHargaLA(3_000, k)).toBe(7_200);
    expect(hitungHargaLA(500, k)).toBe(4_300);
    expect(hitungHargaLA(3_001, k)).toBe(7_200);
    const tengah = hitungHargaLA(2_000, k);
    expect(tengah).toBeGreaterThanOrEqual(4_300);
    expect(tengah).toBeLessThanOrEqual(7_200);
  });

  it("minimum = maksimum: harga tetap berapa pun bebannya", () => {
    const k = { hargaMin: 5_000, hargaMaks: 5_000, bebanRingan: 2_000, bebanBerat: 5_000 };
    for (const n of [0, 2_000, 3_500, 5_000, 99_000]) expect(hitungHargaLA(n, k)).toBe(5_000);
  });

  it("pengaturan tidak sah (maksimum < minimum, berat <= ringan, bukan bilangan bulat) memakai nilai bawaan seluruhnya", () => {
    const rusak: unknown[] = [
      { hargaMin: 7_500, hargaMaks: 4_500, bebanRingan: 6_500, bebanBerat: 13_500 },
      { hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 13_500, bebanBerat: 6_500 },
      { hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 6_500 },
      { hargaMin: 4_500.5, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 },
      { hargaMin: "4500", hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 },
      { hargaMin: 0, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 },
      // bentuk lama (berdasarkan jumlah soal) tidak lagi dikenali
      { hargaMin: 4_500, hargaMaks: 7_500, soalRingan: 20, soalBerat: 50 },
      {},
      null,
    ];
    for (const r of rusak) {
      expect(hitungHargaLA(10_000, r as never), JSON.stringify(r)).toBe(hitungHargaLA(10_000, K));
      expect(perbaikiKonfigHargaLA(r)).toEqual(K);
    }
  });
});

describe("rentangHargaLA", () => {
  it("rentang umum untuk halaman Wallet", () => {
    expect(rentangHargaLA()).toEqual({ min: 4_500, maks: 7_500 });
    expect(rentangHargaLA({ hargaMin: 5_000, hargaMaks: 9_000, bebanRingan: 1_000, bebanBerat: 2_000 })).toEqual({ min: 5_000, maks: 9_000 });
  });
});

describe("validasiKonfigHargaLA", () => {
  const sah = { hargaMin: 4_500, hargaMaks: 7_500, bebanRingan: 6_500, bebanBerat: 13_500 };

  it("pengaturan sah diterima apa adanya", () => {
    expect(validasiKonfigHargaLA(sah)).toEqual({ ok: true, konfig: sah });
    expect(validasiKonfigHargaLA({ ...sah, hargaMaks: 4_500 })).toMatchObject({ ok: true });
    expect(validasiKonfigHargaLA({ ...sah, bebanRingan: 100, bebanBerat: 101 })).toMatchObject({ ok: true });
    expect(validasiKonfigHargaLA({ ...sah, bebanBerat: 1_000_000 })).toMatchObject({ ok: true });
  });

  it("setiap aturan punya pesan sendiri", () => {
    const galat = (o: Record<string, unknown>) => {
      const r = validasiKonfigHargaLA({ ...sah, ...o });
      return r.ok ? null : r.error;
    };
    expect(galat({ hargaMin: 499 })).toBe("Harga minimum minimal Rp500.");
    expect(galat({ hargaMin: 0 })).toBe("Harga minimum minimal Rp500.");
    expect(galat({ hargaMin: -500 })).toBe("Harga minimum minimal Rp500.");
    expect(galat({ hargaMaks: 4_000 })).toBe("Harga maksimum tidak boleh lebih kecil dari harga minimum.");
    expect(galat({ hargaMaks: 1_000_001 })).toContain("tidak boleh lebih dari Rp");
    expect(galat({ bebanRingan: 99 })).toBe("Batas beban ringan minimal 100 token.");
    expect(galat({ bebanRingan: 0 })).toBe("Batas beban ringan minimal 100 token.");
    expect(galat({ bebanBerat: 6_500 })).toBe("Batas beban berat harus lebih besar dari batas beban ringan.");
    expect(galat({ bebanBerat: 1_000 })).toBe("Batas beban berat harus lebih besar dari batas beban ringan.");
    expect(galat({ bebanBerat: 1_000_001 })).toContain("tidak boleh lebih dari 1.000.000 token");
  });

  it("bukan bilangan bulat, teks, kosong, atau tidak lengkap ditolak", () => {
    for (const o of [{ hargaMin: 4_500.5 }, { hargaMaks: "7500" }, { bebanRingan: null }, { bebanBerat: undefined }, { hargaMin: Number.NaN }, { hargaMaks: Number.POSITIVE_INFINITY }]) {
      expect(validasiKonfigHargaLA({ ...sah, ...o }), JSON.stringify(o)).toEqual({ ok: false, error: "Semua isian harus berupa angka bulat." });
    }
    expect(validasiKonfigHargaLA(null)).toMatchObject({ ok: false });
    expect(validasiKonfigHargaLA(undefined)).toMatchObject({ ok: false });
    expect(validasiKonfigHargaLA({})).toMatchObject({ ok: false });
    expect(validasiKonfigHargaLA("teks")).toMatchObject({ ok: false });
    // bentuk lama (jumlah soal) dari halaman admin yang masih terbuka: ditolak, tidak diam-diam diterima
    expect(validasiKonfigHargaLA({ hargaMin: 4_500, hargaMaks: 7_500, soalRingan: 20, soalBerat: 50 })).toEqual({
      ok: false,
      error: "Semua isian harus berupa angka bulat.",
    });
  });
});

describe("contohHargaLA (pratinjau admin)", () => {
  it("bawaan: 6.500, 8.250, 10.000, 11.750, 13.500 token, urut; harganya sama dengan hitungHargaLA", () => {
    const contoh = contohHargaLA();
    expect(contoh.map((c) => c.beban)).toEqual([6_500, 8_250, 10_000, 11_750, 13_500]);
    expect(contoh.map((c) => c.harga)).toEqual([4_500, 5_500, 6_000, 7_000, 7_500]);
    for (const c of contoh) expect(c.harga).toBe(hitungHargaLA(c.beban));
  });

  it("tiap contoh membawa perkiraan banyak soal biasa yang setara dan naik seiring beban", () => {
    const contoh = contohHargaLA();
    expect(contoh.map((c) => c.perkiraanSoal)).toEqual([19, 27, 35, 43, 50]);
    for (let i = 1; i < contoh.length; i++) expect(contoh[i]!.perkiraanSoal).toBeGreaterThan(contoh[i - 1]!.perkiraanSoal);
  });

  it("rentang sangat sempit tidak menghasilkan baris kembar", () => {
    const contoh = contohHargaLA({ hargaMin: 500, hargaMaks: 1_000, bebanRingan: 100, bebanBerat: 101 });
    expect(contoh.map((c) => c.beban)).toEqual([100, 101]);
    const beban = contohHargaLA({ hargaMin: 500, hargaMaks: 1_000, bebanRingan: 500, bebanBerat: 504 }).map((c) => c.beban);
    expect(new Set(beban).size).toBe(beban.length);
    expect([...beban].sort((a, b) => a - b)).toEqual(beban);
  });

  it("pengaturan rusak jatuh ke bawaan", () => {
    expect(contohHargaLA({ hargaMin: 1, hargaMaks: 0, bebanRingan: 0, bebanBerat: 0 })).toEqual(contohHargaLA());
  });
});
