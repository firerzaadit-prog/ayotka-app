import { describe, expect, it } from "vitest";
import { aktivasiManualSchema } from "@/lib/validations/aktivasi-manual";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

describe("aktivasiManualSchema", () => {
  it("menerima aktivasi langganan lengkap", () => {
    const hasil = aktivasiManualSchema.safeParse({
      tipe: "langganan",
      studentId: UUID,
      planId: UUID2,
      catatan: "Bukti bayar WA 1 Okt 14.02, pesanan affiliate.id #123",
    });
    expect(hasil.success).toBe(true);
  });

  it("menerima top-up dengan nominal yang tersedia", () => {
    expect(
      aktivasiManualSchema.safeParse({ tipe: "topup", studentId: UUID, nominal: 25_000, catatan: "bukti WA" }).success,
    ).toBe(true);
  });

  it("menolak nominal top-up di luar denominasi", () => {
    expect(
      aktivasiManualSchema.safeParse({ tipe: "topup", studentId: UUID, nominal: 30_000, catatan: "bukti WA" }).success,
    ).toBe(false);
  });

  it("catatan wajib: kosong, spasi saja, atau terlalu pendek ditolak", () => {
    for (const catatan of ["", "   ", "ab"]) {
      expect(
        aktivasiManualSchema.safeParse({ tipe: "langganan", studentId: UUID, planId: UUID2, catatan }).success,
      ).toBe(false);
    }
  });

  it("menolak id bukan UUID dan tipe tidak dikenal", () => {
    expect(
      aktivasiManualSchema.safeParse({ tipe: "langganan", studentId: "bukan-uuid", planId: UUID2, catatan: "bukti" }).success,
    ).toBe(false);
    expect(aktivasiManualSchema.safeParse({ tipe: "hadiah", studentId: UUID, catatan: "bukti" }).success).toBe(false);
  });
});
