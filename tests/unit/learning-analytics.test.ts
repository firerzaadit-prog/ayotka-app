import { describe, expect, it } from "vitest";
import { putuskanLearningAnalytics } from "@/lib/billing/learning-analytics";

describe("putuskanLearningAnalytics", () => {
  it("paket gratis dengan saldo cukup -> LA jalan, dibayar saldo", () => {
    expect(putuskanLearningAnalytics({ tipe: "gratis", kuotaSisa: null, saldo: 9000, harga: 9000 })).toEqual({
      diminta: true,
      sumber: "saldo",
    });
  });

  it("paket gratis dengan saldo kurang -> ditolak dengan rincian saldo & harga", () => {
    expect(putuskanLearningAnalytics({ tipe: "gratis", kuotaSisa: null, saldo: 8999, harga: 9000 })).toEqual({
      diminta: false,
      alasan: "saldo_tidak_cukup",
      saldo: 8999,
      harga: 9000,
    });
  });

  it("paket gratis tidak pernah dapat LA gratis, walau kuotaSisa terkirim positif", () => {
    const hasil = putuskanLearningAnalytics({ tipe: "gratis", kuotaSisa: 5, saldo: 0, harga: 9000 });
    expect(hasil.diminta).toBe(false);
  });

  it("langganan dengan jatah tersisa -> pakai jatah, saldo tidak disentuh", () => {
    expect(putuskanLearningAnalytics({ tipe: "langganan", kuotaSisa: 1, saldo: 0, harga: 9000 })).toEqual({
      diminta: true,
      sumber: "kuota",
    });
  });

  it("langganan dengan jatah habis -> jatuh ke saldo; kalau saldo kurang ditolak", () => {
    expect(putuskanLearningAnalytics({ tipe: "langganan", kuotaSisa: 0, saldo: 20000, harga: 9000 })).toEqual({
      diminta: true,
      sumber: "saldo",
    });
    expect(putuskanLearningAnalytics({ tipe: "langganan", kuotaSisa: 0, saldo: 100, harga: 9000 }).diminta).toBe(false);
  });

  it("langganan tanpa data kuota (null) diperlakukan sama seperti jatah habis", () => {
    expect(putuskanLearningAnalytics({ tipe: "langganan", kuotaSisa: null, saldo: 0, harga: 9000 }).diminta).toBe(false);
  });

  it("sekolah selalu boleh tanpa jatah/saldo", () => {
    expect(putuskanLearningAnalytics({ tipe: "sekolah", kuotaSisa: null, saldo: 0, harga: 9000 })).toEqual({
      diminta: true,
      sumber: "sekolah",
    });
  });
});
