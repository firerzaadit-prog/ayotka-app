import { describe, expect, it } from "vitest";
import { dariInputWaktuWIB, keInputWaktuWIB } from "@/lib/utils/datetime";
import { adaWaktuTidakValid, toNullableDate } from "@/lib/validations/question";
import { assignmentCreateSchema, assignmentUpdateSchema } from "@/lib/validations/assignment";

// Server produksi bisa berzona UTC (atau apa pun), sedangkan admin mengetik jam WIB. Semua hasil di sini harus sama di
// zona mesin mana pun: jalankan juga dengan `TZ=UTC npx vitest run tests/unit/waktu-wib-input.test.ts`.
const iso = (d: Date | null) => d?.toISOString() ?? null;

describe("dariInputWaktuWIB - waktu tanpa zona dibaca sebagai WIB (UTC+7)", () => {
  it("08.00 tanpa zona = 01.00 UTC", () => {
    expect(iso(dariInputWaktuWIB("2026-10-08T08:00"))).toBe("2026-10-08T01:00:00.000Z");
  });

  it("tengah malam WIB jatuh di hari sebelumnya menurut UTC", () => {
    expect(iso(dariInputWaktuWIB("2026-10-08T00:00"))).toBe("2026-10-07T17:00:00.000Z");
    expect(iso(dariInputWaktuWIB("2026-10-08T06:59"))).toBe("2026-10-07T23:59:00.000Z");
  });

  it("23.59 WIB dan pergantian bulan/tahun", () => {
    expect(iso(dariInputWaktuWIB("2026-12-31T23:59"))).toBe("2026-12-31T16:59:00.000Z");
    expect(iso(dariInputWaktuWIB("2027-01-01T00:30"))).toBe("2026-12-31T17:30:00.000Z");
  });

  it("detik, pecahan detik, dan spasi sebagai pemisah diterima", () => {
    expect(iso(dariInputWaktuWIB("2026-10-08T08:00:30"))).toBe("2026-10-08T01:00:30.000Z");
    expect(iso(dariInputWaktuWIB("2026-10-08T08:00:30.250"))).toBe("2026-10-08T01:00:30.000Z");
    expect(iso(dariInputWaktuWIB("2026-10-08 08:00"))).toBe("2026-10-08T01:00:00.000Z");
    expect(iso(dariInputWaktuWIB("  2026-10-08T08:00  "))).toBe("2026-10-08T01:00:00.000Z");
  });

  it("waktu yang sudah membawa zona dipakai apa adanya (tidak digeser lagi)", () => {
    expect(iso(dariInputWaktuWIB("2026-10-08T01:00:00.000Z"))).toBe("2026-10-08T01:00:00.000Z");
    expect(iso(dariInputWaktuWIB("2026-10-08T08:00:00+07:00"))).toBe("2026-10-08T01:00:00.000Z");
    expect(iso(dariInputWaktuWIB("2026-10-08T08:00:00+0700"))).toBe("2026-10-08T01:00:00.000Z");
    expect(iso(dariInputWaktuWIB("2026-10-07T20:00:00-05:00"))).toBe("2026-10-08T01:00:00.000Z");
  });

  it.each([
    "",
    "   ",
    "abc",
    "2026-10-08",
    "08:00",
    "2026-02-31T10:00",
    "2026-13-01T10:00",
    "2026-10-08T24:00",
    "2026-10-08T25:00",
    "2026-10-08T10:60",
    "2026-10-08T10:00:60",
    "2026-10-08T10",
    "2026/10/08 10:00",
  ])("teks yang tidak bisa dibaca (%j) -> null", (teks) => {
    expect(dariInputWaktuWIB(teks)).toBeNull();
  });

  it("29 Februari hanya sah di tahun kabisat", () => {
    expect(dariInputWaktuWIB("2028-02-29T10:00")).not.toBeNull();
    expect(dariInputWaktuWIB("2026-02-29T10:00")).toBeNull();
  });
});

describe("keInputWaktuWIB - kebalikannya, untuk mengisi form", () => {
  it("menampilkan jam WIB, bukan UTC", () => {
    expect(keInputWaktuWIB("2026-10-08T01:00:00.000Z")).toBe("2026-10-08T08:00");
    expect(keInputWaktuWIB(new Date("2026-10-07T17:00:00.000Z"))).toBe("2026-10-08T00:00");
  });

  it("bolak-balik dengan dariInputWaktuWIB menghasilkan nilai yang sama", () => {
    for (const nilai of ["2026-10-08T08:00", "2026-12-31T23:59", "2027-01-01T00:00", "2026-03-01T12:30"]) {
      expect(keInputWaktuWIB(dariInputWaktuWIB(nilai))).toBe(nilai);
    }
  });

  it("kosong atau tidak valid -> teks kosong (form tidak diisi)", () => {
    expect(keInputWaktuWIB(null)).toBe("");
    expect(keInputWaktuWIB(undefined)).toBe("");
    expect(keInputWaktuWIB("")).toBe("");
    expect(keInputWaktuWIB("bukan tanggal")).toBe("");
  });
});

describe("skema penugasan - jadwal dibaca sebagai WIB", () => {
  const paket = "0f8d3acf-76bd-4d04-871c-769e0124a500";

  it("membuat penugasan: mulai/selesai tanpa zona menjadi waktu WIB", () => {
    const r = assignmentCreateSchema.safeParse({ packageId: paket, mulai: "2026-10-08T08:00", selesai: "2026-10-08T10:00" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(iso(r.data.mulai)).toBe("2026-10-08T01:00:00.000Z");
      expect(iso(r.data.selesai)).toBe("2026-10-08T03:00:00.000Z");
    }
  });

  it("selesai harus setelah mulai (pesan di bidang selesai)", () => {
    const r = assignmentCreateSchema.safeParse({ packageId: paket, mulai: "2026-10-08T10:00", selesai: "2026-10-08T10:00" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Waktu selesai harus setelah waktu mulai.");
      expect(r.error.issues[0]?.path).toEqual(["selesai"]);
    }
  });

  it("selesai lebih awal dari mulai ditolak", () => {
    expect(assignmentCreateSchema.safeParse({ packageId: paket, mulai: "2026-10-08T10:00", selesai: "2026-10-08T09:59" }).success).toBe(false);
  });

  it.each([
    [{ packageId: paket, mulai: "bukan waktu", selesai: "2026-10-08T10:00" }, "Format waktu tidak valid."],
    [{ packageId: paket, mulai: "2026-10-08T08:00", selesai: "2026-02-31T10:00" }, "Format waktu tidak valid."],
    [{ packageId: paket, mulai: "2026-10-08T08:00" }, "Waktu wajib diisi."],
    [{ packageId: "bukan-uuid", mulai: "2026-10-08T08:00", selesai: "2026-10-08T10:00" }, "Paket soal tidak valid."],
  ])("masukan tak sah ditolak dengan pesan jelas", (masukan, pesan) => {
    const r = assignmentCreateSchema.safeParse(masukan);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe(pesan);
  });

  it("ubah penugasan: salah satu bidang cukup, dibaca sebagai WIB", () => {
    const r = assignmentUpdateSchema.safeParse({ selesai: "2026-10-09T12:00" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(iso(r.data.selesai ?? null)).toBe("2026-10-09T05:00:00.000Z");
      expect(r.data.mulai).toBeUndefined();
    }
    expect(assignmentUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("ubah penugasan tanpa bidang apa pun ditolak", () => {
    const r = assignmentUpdateSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("Tidak ada yang diubah.");
  });
});

describe("toNullableDate (jadwal buka paket) - WIB juga", () => {
  it("'' -> null, undefined -> undefined", () => {
    expect(toNullableDate("")).toBeNull();
    expect(toNullableDate("   ")).toBeNull();
    expect(toNullableDate(undefined)).toBeUndefined();
  });

  it("waktu tanpa zona dibaca sebagai WIB", () => {
    expect(iso(toNullableDate("2026-10-08T08:00") as Date)).toBe("2026-10-08T01:00:00.000Z");
  });

  it("ISO berzona dari klien lama tetap sama", () => {
    expect(iso(toNullableDate("2026-10-08T01:00:00.000Z") as Date)).toBe("2026-10-08T01:00:00.000Z");
  });

  it("teks rusak menghasilkan Invalid Date yang terdeteksi adaWaktuTidakValid", () => {
    const d = toNullableDate("bukan waktu");
    expect(d).toBeInstanceOf(Date);
    expect(adaWaktuTidakValid(d)).toBe(true);
    expect(adaWaktuTidakValid(null, undefined, new Date())).toBe(false);
    expect(adaWaktuTidakValid(new Date("2026-10-08T01:00:00Z"), d)).toBe(true);
  });
});
