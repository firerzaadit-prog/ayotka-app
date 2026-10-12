import { describe, expect, it } from "vitest";
import { DAFTAR_KODE_PRODUK, KODE_PRODUK_AFFILIATE, jenisDariKode, kodeProdukDariAlamat } from "@/lib/billing/affiliate-produk";
import { ringkasDataDiterima } from "@/lib/billing/affiliate-data";

const minta = (url: string) => new Request(url);

describe("jenisDariKode", () => {
  it("setiap kode produk dipetakan ke jenis yang benar (jangan sampai tertukar)", () => {
    expect(jenisDariKode("topup25k")).toBe("topup_25k");
    expect(jenisDariKode("topup50k")).toBe("topup_50k");
    expect(jenisDariKode("bulanan")).toBe("langganan_bulanan");
    expect(jenisDariKode("semester")).toBe("langganan_semester");
    expect([...DAFTAR_KODE_PRODUK].sort()).toEqual(["bulanan", "semester", "topup25k", "topup50k"]);
    expect(Object.values(KODE_PRODUK_AFFILIATE).map((p) => p.label)).toEqual(["Top Up 25.000", "Top Up 50.000", "Paket Bulanan", "Paket Semester"]);
  });

  it("huruf besar dan spasi di sekitar kode dimaklumi; kode lain, kosong, atau nama bawaan objek ditolak", () => {
    expect(jenisDariKode(" Topup25K ")).toBe("topup_25k");
    for (const salah of [null, undefined, "", "  ", "topup", "topup-25k", "25000", "constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(jenisDariKode(salah), String(salah)).toBeNull();
    }
  });
});

describe("kodeProdukDariAlamat", () => {
  it("membaca ?produk= dari alamat, juga bila token mendahuluinya", () => {
    expect(kodeProdukDariAlamat(minta("https://ayotka.id/api/webhooks/affiliate/success?token=abc&produk=topup25k"))).toBe("topup25k");
    expect(kodeProdukDariAlamat(minta("https://ayotka.id/api/webhooks/affiliate/success?produk=bulanan&token=abc"))).toBe("bulanan");
  });

  it("tahan terhadap '?' atau '&' tambahan yang ditempel affiliate.id setelah kode", () => {
    expect(kodeProdukDariAlamat(minta("https://ayotka.id/x?token=abc&produk=semester?uid=1"))).toBe("semester");
    expect(kodeProdukDariAlamat(minta("https://ayotka.id/x?token=abc&produk=semester#bagian"))).toBe("semester");
  });

  it("tanpa kode atau kode kosong: null", () => {
    expect(kodeProdukDariAlamat(minta("https://ayotka.id/x?token=abc"))).toBeNull();
    expect(kodeProdukDariAlamat(minta("https://ayotka.id/x?token=abc&produk="))).toBeNull();
    expect(kodeProdukDariAlamat(minta("https://ayotka.id/x?token=abc&produk=%20"))).toBeNull();
  });
});

describe("ringkasDataDiterima", () => {
  it("bukan objek biasa atau kosong: null", () => {
    for (const nilai of [null, undefined, "teks", 5, [1, 2], {}]) expect(ringkasDataDiterima(nilai), String(nilai)).toBeNull();
  });

  it("nilai dijadikan teks, objek bersarang jadi JSON, nilai panjang dipotong, kunci token dibuang", () => {
    const hasil = ringkasDataDiterima({ uid: "u-1", duration: 30, bersarang: { a: 1 }, panjang: "x".repeat(500), token: "RAHASIA", Token: "RAHASIA2" })!;
    expect(hasil.uid).toBe("u-1");
    expect(hasil.duration).toBe("30");
    expect(hasil.bersarang).toBe('{"a":1}');
    expect(hasil.panjang).toHaveLength(203);
    expect(hasil.panjang!.endsWith("...")).toBe(true);
    expect(JSON.stringify(hasil)).not.toContain("RAHASIA");
  });

  it("paling banyak 30 kunci", () => {
    const banyak = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(ringkasDataDiterima(banyak)!)).toHaveLength(30);
  });
});
