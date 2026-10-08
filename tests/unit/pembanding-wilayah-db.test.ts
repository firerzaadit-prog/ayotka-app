import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { PrismaClient } from "@prisma/client";
import { ambilPembandingWilayah, kosongkanCachePembandingWilayah } from "@/lib/indikator/pembanding-wilayah";
import { FILTER_WILAYAH_KOSONG, type FilterWilayah } from "@/lib/wilayah/cakupan";

interface SqlTiruan {
  /** Prisma.Sql: `text` memakai penanda $1, $2, ... (`sql` memakai ?). */
  text: string;
  values: unknown[];
}

const queryRaw = vi.fn();
const db = { $queryRaw: queryRaw } as unknown as PrismaClient;

/** Dua query per perhitungan (indikator, sekolah) dijawab sesuai isi SQL-nya. */
function jawab(
  indikator: Array<{ indikator_id: string; skor: number; skor_maks: number; jml_soal: number; jml_sekolah: number }>,
  sekolah: Array<{ school_id: string; skor: number; skor_maks: number; jml_siswa: number }>,
) {
  queryRaw.mockImplementation(async (q: SqlTiruan) => (q.text.includes("GROUP BY q.indikator_id") ? indikator : sekolah));
}

const SENDIRI = "sek-sendiri";
const sekolahCukup = [
  { school_id: SENDIRI, skor: 60, skor_maks: 100, jml_siswa: 10 },
  { school_id: "b", skor: 50, skor_maks: 100, jml_siswa: 10 },
  { school_id: "c", skor: 70, skor_maks: 100, jml_siswa: 10 },
];
const panggil = (o: { filter?: Partial<FilterWilayah>; subjectId?: string; rentang?: { dari?: Date; sampai?: Date } | null; sekarang?: number } = {}) =>
  ambilPembandingWilayah(db, {
    schoolIdSendiri: SENDIRI,
    subjectId: o.subjectId ?? "mapel-1",
    filter: { ...FILTER_WILAYAH_KOSONG, ...o.filter },
    rentang: o.rentang,
    sekarang: o.sekarang ?? 1_000_000,
  });
const sqlTerakhir = (i = 0) => queryRaw.mock.calls[i]![0] as SqlTiruan;

beforeEach(() => {
  queryRaw.mockReset();
  kosongkanCachePembandingWilayah();
  jawab([{ indikator_id: "i1", skor: 55, skor_maks: 100, jml_soal: 100, jml_sekolah: 3 }], sekolahCukup);
});

describe("ambilPembandingWilayah - hasil", () => {
  it("memetakan baris SQL menjadi pembanding (angka dari driver bisa berupa string/bigint)", async () => {
    jawab(
      [{ indikator_id: "i1", skor: "55" as unknown as number, skor_maks: "100" as unknown as number, jml_soal: BigInt(100) as unknown as number, jml_sekolah: 3 }],
      sekolahCukup,
    );
    const p = await panggil();
    expect(p.cukup).toBe(true);
    expect(p.perIndikator.i1!.dayaSerap).toBeCloseTo(55, 8);
    expect(p.perIndikator.i1).toMatchObject({ jmlJawaban: 100, jmlSekolah: 3 });
    expect(p.posisi).toEqual({ peringkat: 2, dari: 3, persentil: 50 });
  });

  it("dua query agregat dijalankan (per indikator dan per sekolah), bukan memuat jawaban satu per satu", async () => {
    await panggil();
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(sqlTerakhir(0).text).toContain("GROUP BY q.indikator_id");
    expect(sqlTerakhir(1).text).toContain("GROUP BY pr.school_id");
  });

  it("identitas sekolah lain tidak ada di hasil", async () => {
    expect(JSON.stringify(await panggil())).not.toMatch(/"b"|"c"|sek-sendiri/);
  });
});

describe("ambilPembandingWilayah - SQL", () => {
  it("aturan data: percobaan pertama, selesai/kedaluwarsa, Jalur A, siswa belum dihapus, sekolah aktif, satu mapel", async () => {
    await panggil({ subjectId: "mapel-xyz" });
    const { text: sql, values } = sqlTerakhir(0);
    expect(sql).toContain("DISTINCT ON (a.student_id, a.package_id)");
    expect(sql).toContain("ORDER BY a.student_id, a.package_id, a.mulai_at ASC, a.id ASC");
    expect(sql).toContain("a.status IN ('selesai', 'kedaluwarsa')");
    expect(sql).toContain("s.jalur = 'A'");
    expect(sql).toContain("s.deleted_at IS NULL");
    expect(sql).toContain("sc.status = 'aktif'");
    expect(sql).toContain("p.subject_id = $1::uuid");
    expect(values).toContain("mapel-xyz");
    expect(sql).toContain("q.indikator_id IS NOT NULL AND aa.skor_maks > 0");
    expect(sql).toContain("LEAST(GREATEST(COALESCE(aa.skor, 0), 0), aa.skor_maks)");
  });

  it("nasional tanpa filter: tidak ada kondisi wilayah, status, maupun waktu", async () => {
    await panggil();
    const { text: sql } = sqlTerakhir(0);
    expect(sql).not.toContain("sc.kabupaten_kota");
    expect(sql).not.toContain("sc.provinsi");
    expect(sql).not.toContain("sc.status_sekolah");
    expect(sql).not.toContain("a.mulai_at >=");
  });

  it("kota/kabupaten: satu kondisi dengan nilai sebagai parameter (bukan disisipkan ke teks SQL)", async () => {
    await panggil({ filter: { provinsi: "Jawa Timur", kabupatenKota: "Kota Malang" } });
    const { text: sql, values } = sqlTerakhir(0);
    expect(sql).toContain("sc.kabupaten_kota = $2");
    expect(values).toContain("Kota Malang");
    expect(sql).not.toContain("Kota Malang");
    expect(sql).not.toContain("sc.provinsi");
  });

  it("hanya provinsi: kolom provinsi ATAU daftar kota/kabupaten provinsi itu (untuk sekolah yang provinsinya belum terisi)", async () => {
    await panggil({ filter: { provinsi: "Bali" } });
    const { text: sql, values } = sqlTerakhir(0);
    expect(sql).toContain("(sc.provinsi = $2 OR sc.kabupaten_kota IN (");
    expect(values).toContain("Bali");
    expect(values).toContain("Kota Denpasar");
    expect(values).not.toContain("Kota Malang");
  });

  it("status sekolah dikirim sebagai parameter dengan cast ke enum", async () => {
    await panggil({ filter: { statusSekolah: "swasta" } });
    const { text: sql, values } = sqlTerakhir(0);
    expect(sql).toContain('sc.status_sekolah = $2::"StatusSekolah"');
    expect(values).toContain("swasta");
  });

  it("rentang waktu: dibandingkan sebagai UTC lewat string ISO + ::timestamp (aman untuk zona waktu sesi apa pun)", async () => {
    await panggil({ rentang: { dari: new Date("2026-10-01T00:00:00Z"), sampai: new Date("2026-12-31T16:59:59.999Z") } });
    const { text: sql, values } = sqlTerakhir(0);
    expect(sql).toContain("a.mulai_at >= $2::timestamp");
    expect(sql).toContain("a.mulai_at <= $3::timestamp");
    expect(values).toContain("2026-10-01T00:00:00.000Z");
    expect(values).toContain("2026-12-31T16:59:59.999Z");
  });

  it("rentang separuh terbuka hanya memasang batas yang ada", async () => {
    await panggil({ rentang: { dari: new Date("2026-10-01T00:00:00Z") } });
    expect(sqlTerakhir(0).text).toContain("a.mulai_at >=");
    expect(sqlTerakhir(0).text).not.toContain("a.mulai_at <=");
  });

  it("kedua query memakai kondisi yang sama persis", async () => {
    await panggil({ filter: { provinsi: "Bali", statusSekolah: "negeri" }, rentang: { dari: new Date("2026-10-01T00:00:00Z") } });
    const a = sqlTerakhir(0);
    const b = sqlTerakhir(1);
    const potong = (s: string) => s.slice(s.indexOf("WITH pertama AS"), s.indexOf("SELECT q.indikator_id") > -1 ? s.indexOf("SELECT q.indikator_id") : s.indexOf("SELECT pr.school_id"));
    expect(potong(a.text)).toBe(potong(b.text));
    expect(a.values).toEqual(b.values);
  });
});

describe("ambilPembandingWilayah - cache sementara", () => {
  it("panggilan kedua dengan parameter sama dalam TTL tidak menyentuh database lagi", async () => {
    await panggil({ sekarang: 1_000 });
    await panggil({ sekarang: 30_000 });
    expect(queryRaw).toHaveBeenCalledTimes(2); // hanya perhitungan pertama (2 query)
  });

  it("setelah TTL (60 detik) dihitung ulang", async () => {
    await panggil({ sekarang: 1_000 });
    await panggil({ sekarang: 1_000 + 60_000 });
    expect(queryRaw).toHaveBeenCalledTimes(4);
  });

  it("parameter berbeda tidak berbagi cache (mapel, wilayah, status, rentang)", async () => {
    await panggil();
    await panggil({ subjectId: "mapel-2" });
    await panggil({ filter: { provinsi: "Bali" } });
    await panggil({ filter: { statusSekolah: "negeri" } });
    await panggil({ rentang: { dari: new Date("2026-10-01T00:00:00Z") } });
    expect(queryRaw).toHaveBeenCalledTimes(10);
  });

  it("sekolah pemilik laporan berbeda memakai agregat yang sama tetapi posisinya masing-masing", async () => {
    const a = await ambilPembandingWilayah(db, { schoolIdSendiri: SENDIRI, subjectId: "m", filter: FILTER_WILAYAH_KOSONG, sekarang: 5 });
    const b = await ambilPembandingWilayah(db, { schoolIdSendiri: "c", subjectId: "m", filter: FILTER_WILAYAH_KOSONG, sekarang: 6 });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(a.posisi!.peringkat).toBe(2);
    expect(b.posisi!.peringkat).toBe(1);
  });

  it("galat database tidak disimpan di cache (percobaan berikutnya mencoba lagi)", async () => {
    queryRaw.mockRejectedValueOnce(new Error("db mati"));
    await expect(panggil({ sekarang: 1 })).rejects.toThrow("db mati");
    jawab([], sekolahCukup);
    await expect(panggil({ sekarang: 2 })).resolves.toMatchObject({ cukup: true });
  });
});
