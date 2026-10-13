import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ attempts: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { attempt: { findMany: m.attempts }, periodeLangganan: { findFirst: vi.fn() } } }));

import { buildAnalitikSekolah, buildDaftarSiswaKesiapanSekolah, buildKesiapanSekolah } from "@/lib/analytics/sekolah";
import { daftarMapelLaporan } from "@/lib/indikator/laporan-sekolah";
import { ambilBreakdownKategoriSekolah } from "@/lib/indikator/laporan-breakdown";
import { whereJenisPercobaan } from "@/lib/hasil-tryout/jenis";

const whereTerakhir = () => m.attempts.mock.calls.at(-1)![0].where as Record<string, unknown>;

beforeEach(() => {
  vi.resetAllMocks();
  m.attempts.mockResolvedValue([]);
});

describe("analitik sekolah memakai aturan jenis try out yang sama dengan rapor dan peringkat", () => {
  it("filter jenis dipasang di tingkat percobaan (bukan pada paket saja) dan tidak mengganggu filter paket lain", async () => {
    await buildAnalitikSekolah("sch-1", { subjectId: "m1", kategoriUjian: "sekolah" });
    expect(whereTerakhir()).toMatchObject({ package: { subjectId: "m1" }, ...whereJenisPercobaan("sekolah") });
    await buildKesiapanSekolah("sch-1", { kategoriUjian: "nasional" });
    expect(whereTerakhir()).toMatchObject({ package: { subject: { nama: { in: expect.any(Array) } } }, ...whereJenisPercobaan("nasional") });
    await buildDaftarSiswaKesiapanSekolah("sch-1", { subjectNama: "Matematika", kategoriUjian: "mandiri" });
    expect(whereTerakhir()).toMatchObject({ package: { subject: { nama: "Matematika" } }, ...whereJenisPercobaan("mandiri") });
  });

  it("'sekolah' mencakup penugasan atas paket pusat (bukan hanya paket milik sekolah, yang sudah tidak dipakai)", async () => {
    await buildAnalitikSekolah("sch-1", { kategoriUjian: "sekolah" });
    const w = JSON.stringify(whereTerakhir());
    expect(w).toContain('"assignmentId":{"not":null}');
    expect(w).toContain('"ownerType":"sekolah"');
  });

  it("tanpa jenis atau 'semua': tidak ada penyaringan jenis; nilai tak dikenal diabaikan (perilaku lama)", async () => {
    for (const k of [undefined, null, "semua", "ngawur"] as never[]) {
      await buildAnalitikSekolah("sch-1", { kategoriUjian: k });
      expect(whereTerakhir()).not.toHaveProperty("AND");
    }
  });

  it("daftar mata pelajaran laporan indikator juga menyaring per jenis", async () => {
    await daftarMapelLaporan({ attempt: { findMany: m.attempts } } as never, "sch-1", null, "sekolah");
    expect(whereTerakhir()).toMatchObject(whereJenisPercobaan("sekolah"));
    expect(whereTerakhir()).toHaveProperty("student", { schoolId: "sch-1", jalur: "A", deletedAt: null });
  });
});

describe("rincian per kategori (breakdown) memakai aturan jenis yang sama", () => {
  const percobaan = (id: string, o: { assignmentId?: string | null; kategori: "mandiri" | "nasional"; ownerType: "pusat" | "sekolah" }) => ({
    id,
    studentId: `s-${id}`,
    assignmentId: o.assignmentId ?? null,
    package: { kategori: o.kategori, ownerType: o.ownerType },
    competencyScores: [],
    answers: [],
  });

  it("penugasan atas paket pusat = Sekolah; pilih sendiri = Mandiri; nasional tetap Nasional (juga bila dijadwalkan)", async () => {
    m.attempts.mockResolvedValue([
      percobaan("a", { kategori: "mandiri", ownerType: "pusat", assignmentId: "pen-1" }),
      percobaan("b", { kategori: "mandiri", ownerType: "pusat" }),
      percobaan("c", { kategori: "mandiri", ownerType: "pusat" }),
      percobaan("d", { kategori: "nasional", ownerType: "pusat" }),
      percobaan("e", { kategori: "nasional", ownerType: "pusat", assignmentId: "pen-2" }),
      percobaan("f", { kategori: "mandiri", ownerType: "sekolah" }),
    ]);
    const h = await ambilBreakdownKategoriSekolah({ attempt: { findMany: m.attempts } } as never, "sch-1", "m1", null);
    expect(h.sekolah.jumlahPercobaan).toBe(2); // a (penugasan) dan f (paket milik sekolah)
    expect(h.mandiri.jumlahPercobaan).toBe(2); // b, c
    expect(h.nasional.jumlahPercobaan).toBe(2); // d, e
    expect(h.gabungan.jumlahPercobaan).toBe(6);
    expect(h.sekolah.jumlahSiswa).toBe(2);
  });

  it("assignmentId ikut dibaca dari database", async () => {
    await ambilBreakdownKategoriSekolah({ attempt: { findMany: m.attempts } } as never, "sch-1", "m1", null);
    expect(m.attempts.mock.calls[0]![0].select).toMatchObject({ assignmentId: true });
  });
});
