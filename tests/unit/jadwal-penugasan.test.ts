import { describe, expect, it } from "vitest";
import { periksaJadwalPenugasan } from "@/lib/exam/jadwal-penugasan";
import { wherePaketTersedia } from "@/lib/exam/paket-tersedia";

const SEKARANG = new Date("2026-10-08T00:00:00.000Z");
const d = (iso: string) => new Date(iso);

// Periode contoh: 1 Okt 2026 00.00 WIB sampai 31 Des 2026 (akhir hari WIB), tenggang 14 hari -> siswa boleh mulai sampai 14 Jan 2027.
const periode = (extra: Partial<{ mulai: Date; berakhir: Date; masaTenggangHari: number; dicabutAt: Date | null }> = {}) => ({
  mulai: d("2026-09-30T17:00:00.000Z"),
  berakhir: d("2026-12-31T16:59:59.999Z"),
  masaTenggangHari: 14,
  dicabutAt: null,
  ...extra,
});

const periksa = (mulai: string, selesai: string, p = [periode()]) =>
  periksaJadwalPenugasan({ mulai: d(mulai), selesai: d(selesai), sekarang: SEKARANG, periode: p });

describe("periksaJadwalPenugasan - waktu selesai harus di masa depan", () => {
  it("selesai sebelum sekarang -> 400 JADWAL_LEWAT", () => {
    const r = periksa("2026-10-06T01:00:00Z", "2026-10-07T01:00:00Z");
    expect(r).toMatchObject({ ok: false, status: 400, code: "JADWAL_LEWAT", error: "Waktu selesai harus di masa depan." });
  });

  it("selesai tepat sekarang juga dianggap lewat", () => {
    expect(periksa("2026-10-07T00:00:00Z", "2026-10-08T00:00:00Z")).toMatchObject({ ok: false, code: "JADWAL_LEWAT" });
  });

  it("jendela yang sudah mulai tetapi selesainya di masa depan sah (mulai di masa lalu tidak masalah)", () => {
    expect(periksa("2026-10-07T00:00:00Z", "2026-10-08T00:00:01Z")).toEqual({ ok: true });
  });

  it("pemeriksaan waktu didahulukan dari pemeriksaan langganan", () => {
    expect(periksa("2020-01-01T00:00:00Z", "2020-01-02T00:00:00Z", [])).toMatchObject({ code: "JADWAL_LEWAT" });
  });
});

describe("periksaJadwalPenugasan - harus dalam masa langganan sekolah", () => {
  it("sekolah tanpa periode sama sekali -> 403 TANPA_LANGGANAN", () => {
    const r = periksa("2026-10-09T01:00:00Z", "2026-10-09T03:00:00Z", []);
    expect(r).toMatchObject({ ok: false, status: 403, code: "TANPA_LANGGANAN" });
    if (!r.ok) expect(r.error).toContain("belum memiliki langganan aktif");
  });

  it("periode yang dicabut tidak dihitung", () => {
    const r = periksa("2026-10-09T01:00:00Z", "2026-10-09T03:00:00Z", [periode({ dicabutAt: d("2026-10-01T00:00:00Z") })]);
    expect(r).toMatchObject({ ok: false, code: "TANPA_LANGGANAN" });
  });

  it("jendela di dalam periode aktif lolos", () => {
    expect(periksa("2026-10-09T01:00:00Z", "2026-10-09T03:00:00Z")).toEqual({ ok: true });
  });

  it("jendela di masa tenggang (setelah periode berakhir) masih lolos", () => {
    expect(periksa("2027-01-05T01:00:00Z", "2027-01-05T03:00:00Z")).toEqual({ ok: true });
  });

  it("jendela di periode yang BELUM mulai (akan datang) lolos, asalkan beririsan", () => {
    const depan = periode({ mulai: d("2027-01-14T17:00:00Z"), berakhir: d("2027-06-30T16:59:59.999Z") });
    expect(periksa("2027-02-01T01:00:00Z", "2027-02-01T03:00:00Z", [depan])).toEqual({ ok: true });
  });

  it("jendela yang hanya SEBAGIAN beririsan dengan periode lolos (siswa bisa mulai di bagian yang beririsan)", () => {
    // Menjorok melewati akhir masa tenggang.
    expect(periksa("2027-01-14T00:00:00Z", "2027-02-20T00:00:00Z")).toEqual({ ok: true });
    // Menjorok sebelum awal periode yang baru mulai 20 Okt 2026.
    const akanMulai = periode({ mulai: d("2026-10-19T17:00:00Z") });
    expect(periksa("2026-10-10T00:00:00Z", "2026-10-25T00:00:00Z", [akanMulai])).toEqual({ ok: true });
  });

  it("jendela seluruhnya sesudah akhir masa tenggang -> 403 DI_LUAR_LANGGANAN dengan rentang yang disebut", () => {
    const r = periksa("2027-02-01T01:00:00Z", "2027-02-01T03:00:00Z");
    expect(r).toMatchObject({ ok: false, status: 403, code: "DI_LUAR_LANGGANAN" });
    if (!r.ok) {
      expect(r.error).toContain("1 Oktober 2026");
      expect(r.error).toContain("14 Januari 2027");
    }
  });

  it("jendela seluruhnya sebelum periode mulai -> DI_LUAR_LANGGANAN", () => {
    // Periode baru mulai 1 Jan 2027; jendela 20-21 Okt 2026 jatuh sebelum itu.
    const nanti = periode({ mulai: d("2026-12-31T17:00:00Z"), berakhir: d("2027-06-30T16:59:59.999Z") });
    expect(periksa("2026-10-20T00:00:00Z", "2026-10-21T00:00:00Z", [nanti])).toMatchObject({ code: "DI_LUAR_LANGGANAN" });
  });

  it("batas tepat termasuk: mulai tepat di akhir masa tenggang, atau selesai tepat di awal periode", () => {
    const p = periode();
    const akhir = new Date(p.berakhir.getTime() + 14 * 24 * 60 * 60 * 1000);
    expect(periksaJadwalPenugasan({ mulai: akhir, selesai: new Date(akhir.getTime() + 3_600_000), sekarang: SEKARANG, periode: [p] })).toEqual({ ok: true });
    expect(periksaJadwalPenugasan({ mulai: new Date(akhir.getTime() + 1), selesai: new Date(akhir.getTime() + 3_600_000), sekarang: SEKARANG, periode: [p] })).toMatchObject({
      code: "DI_LUAR_LANGGANAN",
    });
  });

  it("dua periode: jendela setelah semuanya ditolak, dan pesan merujuk periode yang berakhir paling akhir", () => {
    const a = periode({ mulai: d("2026-01-01T00:00:00Z"), berakhir: d("2026-03-31T16:59:59.999Z"), masaTenggangHari: 0 });
    const b = periode({ mulai: d("2026-09-30T17:00:00Z"), berakhir: d("2026-12-31T16:59:59.999Z") });
    const r = periksa("2027-03-01T00:00:00Z", "2027-03-02T00:00:00Z", [a, b]);
    expect(r).toMatchObject({ ok: false, code: "DI_LUAR_LANGGANAN" });
    if (!r.ok) expect(r.error).toContain("14 Januari 2027");
  });

  it("beberapa periode: cukup beririsan dengan salah satunya", () => {
    const a = periode({ mulai: d("2026-01-01T00:00:00Z"), berakhir: d("2026-03-31T16:59:59.999Z"), masaTenggangHari: 0 });
    expect(periksa("2026-10-09T01:00:00Z", "2026-10-09T03:00:00Z", [a, periode()])).toEqual({ ok: true });
  });
});

describe("wherePaketTersedia", () => {
  it("tanpa jenjang: terbit, untuk siswa sekolah/semua, milik sekolah itu ATAU paket pusat yang didistribusikan ke sana", () => {
    expect(wherePaketTersedia("sekolah-1")).toEqual({
      status: "published",
      targetSiswa: { in: ["sekolah", "semua"] },
      OR: [
        { ownerType: "sekolah", ownerId: "sekolah-1" },
        {
          ownerType: "pusat",
          visibility: { some: { OR: [{ targetType: "semua" }, { targetType: "sekolah", schoolId: "sekolah-1" }] } },
        },
      ],
    });
  });

  it("dengan jenjang: hanya paket jenjang itu", () => {
    expect(wherePaketTersedia("sekolah-1", { jenjang: "SMP" })).toMatchObject({ jenjang: "SMP", status: "published" });
    expect(wherePaketTersedia("sekolah-1")).not.toHaveProperty("jenjang");
  });

  it("paket khusus mandiri tidak termasuk (targetSiswa mandiri tidak ada di daftar)", () => {
    const where = wherePaketTersedia("sekolah-1") as { targetSiswa: { in: string[] } };
    expect(where.targetSiswa.in).not.toContain("mandiri");
  });

  it("distribusi hanya berlaku untuk paket pusat (visibility yatim pada paket sekolah tidak membuatnya tersedia di sekolah lain)", () => {
    const where = wherePaketTersedia("sekolah-1") as { OR: { ownerType: string; visibility?: unknown }[] };
    const cabangVisibility = where.OR.find((c) => c.visibility);
    expect(cabangVisibility?.ownerType).toBe("pusat");
  });
});
