import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ attemptFindMany: vi.fn(), schoolFindMany: vi.fn(), subjectFindMany: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    attempt: { findMany: m.attemptFindMany },
    school: { findMany: m.schoolFindMany },
    subject: { findMany: m.subjectFindMany },
  },
}));

import {
  buildAnalitikGlobal,
  buildDaftarSiswaKesiapanAntarSekolah,
  buildKesiapanAntarSekolah,
  buildStatistikMataPelajaran,
} from "@/lib/analytics/global";
import { buildAnalitikSekolah, buildDaftarSiswaKesiapanSekolah, buildKesiapanSekolah } from "@/lib/analytics/sekolah";
import { buildRanking } from "@/lib/exam/ranking";
import { bacaRentangTanggal } from "@/lib/analytics/rentang";
import {
  presetSemesterIni,
  presetTahunAjaranIni,
  presetTigaPuluhHari,
  rentangTanggalValid,
} from "@/lib/analytics/preset-tanggal";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

const DARI = startOfDayWIB("2026-07-01");
const SAMPAI = akhirHariWIB("2026-12-31");
const whereTerakhir = () => m.attemptFindMany.mock.calls.at(-1)![0].where as Record<string, unknown>;

beforeEach(() => {
  vi.resetAllMocks();
  m.attemptFindMany.mockResolvedValue([]);
  m.schoolFindMany.mockResolvedValue([{ id: "s1", nama: "SMP 1", jenjang: "SMP" }]);
  m.subjectFindMany.mockResolvedValue([{ nama: "Matematika", jenjang: "SMP" }]);
});

describe("analitik hanya menghitung siswa Jalur A yang belum dihapus", () => {
  const SISWA_SEKOLAH = { schoolId: "s1", jalur: "A", deletedAt: null };
  const SISWA_LINTAS = { schoolId: { in: ["s1"] }, jalur: "A", deletedAt: null };

  it("analitik sekolah: ranking/kompetensi, kesiapan, dan daftar siswa kesiapan", async () => {
    await buildAnalitikSekolah("s1", {});
    expect(whereTerakhir().student).toEqual(SISWA_SEKOLAH);
    await buildKesiapanSekolah("s1");
    expect(whereTerakhir().student).toEqual(SISWA_SEKOLAH);
    await buildDaftarSiswaKesiapanSekolah("s1", { subjectNama: "Matematika" });
    expect(whereTerakhir().student).toEqual(SISWA_SEKOLAH);
  });

  it("analitik global: statistik, kesiapan antar sekolah, dan daftar siswa kesiapan", async () => {
    await buildAnalitikGlobal({});
    expect(whereTerakhir().student).toEqual(SISWA_LINTAS);
    await buildStatistikMataPelajaran({});
    expect(whereTerakhir().student).toEqual(SISWA_LINTAS);
    await buildKesiapanAntarSekolah({});
    expect(whereTerakhir().student).toEqual(SISWA_LINTAS);
    await buildDaftarSiswaKesiapanAntarSekolah({ subjectNama: "Matematika" });
    expect(whereTerakhir().student).toEqual(SISWA_LINTAS);
  });
});

describe("filter rentang tanggal pada analitik lintas sekolah", () => {
  const rentang = { dari: DARI, sampai: SAMPAI };

  it("menyaring percobaan menurut waktu MULAI ujian di keempat fungsi", async () => {
    await buildAnalitikGlobal(rentang);
    expect(whereTerakhir().mulaiAt).toEqual({ gte: DARI, lte: SAMPAI });
    await buildStatistikMataPelajaran(rentang);
    expect(whereTerakhir().mulaiAt).toEqual({ gte: DARI, lte: SAMPAI });
    await buildKesiapanAntarSekolah(rentang);
    expect(whereTerakhir().mulaiAt).toEqual({ gte: DARI, lte: SAMPAI });
    await buildDaftarSiswaKesiapanAntarSekolah({ subjectNama: "Matematika", ...rentang });
    expect(whereTerakhir().mulaiAt).toEqual({ gte: DARI, lte: SAMPAI });
  });

  it("terbuka di satu sisi: hanya batas yang diisi yang dipakai", async () => {
    await buildAnalitikGlobal({ dari: DARI });
    expect(whereTerakhir().mulaiAt).toEqual({ gte: DARI });
    await buildAnalitikGlobal({ sampai: SAMPAI });
    expect(whereTerakhir().mulaiAt).toEqual({ lte: SAMPAI });
  });

  it("tanpa rentang (atau rentang kosong): tidak ada batas waktu sama sekali (perilaku lama)", async () => {
    await buildAnalitikGlobal({});
    expect(whereTerakhir()).not.toHaveProperty("mulaiAt");
    await buildAnalitikGlobal({ dari: null, sampai: null });
    expect(whereTerakhir()).not.toHaveProperty("mulaiAt");
  });

  it("filter lain (wilayah dinas, jalur, hapus) tetap berlaku bersama rentang tanggal", async () => {
    await buildAnalitikGlobal({ ...rentang, kabupatenKota: "Kota Malang" });
    expect(m.schoolFindMany.mock.calls.at(-1)![0].where).toMatchObject({ status: "aktif", kabupatenKota: "Kota Malang" });
    expect(whereTerakhir()).toMatchObject({ student: { jalur: "A", deletedAt: null }, mulaiAt: { gte: DARI, lte: SAMPAI } });
  });
});

describe("bacaRentangTanggal", () => {
  const baca = (qs: string) => bacaRentangTanggal(new URL(`http://localhost/x?${qs}`));

  it("tanpa parameter, atau parameter kosong: semua waktu", () => {
    expect(baca("")).toEqual({ rentang: null });
    expect(baca("dari=&sampai=")).toEqual({ rentang: null });
  });

  it("tanggal kalender WIB: 'dari' awal hari, 'sampai' AKHIR hari (satu hari penuh tercakup)", () => {
    expect(baca("dari=2026-07-01&sampai=2026-12-31")).toEqual({ rentang: { dari: DARI, sampai: SAMPAI } });
    const sehari = baca("dari=2026-10-03&sampai=2026-10-03");
    expect("rentang" in sehari && sehari.rentang).toEqual({ dari: startOfDayWIB("2026-10-03"), sampai: akhirHariWIB("2026-10-03") });
  });

  it("boleh terbuka di satu sisi", () => {
    expect(baca("dari=2026-07-01")).toEqual({ rentang: { dari: DARI, sampai: null } });
    expect(baca("sampai=2026-12-31")).toEqual({ rentang: { dari: null, sampai: SAMPAI } });
  });

  it.each([
    ["format salah", "dari=01-07-2026"],
    ["tanggal yang tidak ada", "sampai=2026-02-31"],
    ["bukan tanggal", "dari=kemarin"],
    ["mulai setelah akhir", "dari=2026-12-31&sampai=2026-07-01"],
  ])("ditolak 400: %s", async (_nama, qs) => {
    const hasil = baca(qs);
    expect("galat" in hasil).toBe(true);
    if ("galat" in hasil) {
      expect(hasil.galat.status).toBe(400);
      expect((await hasil.galat.json()).error).toEqual(expect.any(String));
    }
  });
});

describe("preset tanggal (kalender akademik, tanggal WIB)", () => {
  it("30 hari terakhir termasuk hari ini", () => {
    expect(presetTigaPuluhHari(new Date("2026-10-03T10:00:00Z"))).toEqual({ dari: "2026-09-04", sampai: "2026-10-03" });
    // lintas bulan dan tahun
    expect(presetTigaPuluhHari(new Date("2027-01-10T10:00:00Z"))).toEqual({ dari: "2026-12-12", sampai: "2027-01-10" });
  });

  it("semester ganjil Juli-Desember, genap Januari-Juni", () => {
    expect(presetSemesterIni(new Date("2026-10-03T10:00:00Z"))).toEqual({ dari: "2026-07-01", sampai: "2026-12-31" });
    expect(presetSemesterIni(new Date("2027-02-10T10:00:00Z"))).toEqual({ dari: "2027-01-01", sampai: "2027-06-30" });
  });

  it("tahun ajaran 1 Juli sampai 30 Juni, termasuk yang berjalan sejak tahun lalu", () => {
    expect(presetTahunAjaranIni(new Date("2026-10-03T10:00:00Z"))).toEqual({ dari: "2026-07-01", sampai: "2027-06-30" });
    expect(presetTahunAjaranIni(new Date("2027-02-10T10:00:00Z"))).toEqual({ dari: "2026-07-01", sampai: "2027-06-30" });
  });

  it("memakai tanggal WIB, bukan UTC: 00.30 WIB tanggal 1 Juli masih 30 Juni di UTC", () => {
    const tengahMalam = new Date("2026-06-30T17:30:00Z"); // 1 Juli 2026 00.30 WIB
    expect(presetSemesterIni(tengahMalam)).toEqual({ dari: "2026-07-01", sampai: "2026-12-31" });
    expect(presetTahunAjaranIni(tengahMalam)).toEqual({ dari: "2026-07-01", sampai: "2027-06-30" });
    const tahunBaru = new Date("2026-12-31T17:30:00Z"); // 1 Januari 2027 00.30 WIB
    expect(presetSemesterIni(tahunBaru)).toEqual({ dari: "2027-01-01", sampai: "2027-06-30" });
    expect(presetTigaPuluhHari(tahunBaru).sampai).toBe("2027-01-01");
  });

  it("rentang valid: kosong di salah satu sisi boleh, mulai setelah akhir tidak", () => {
    expect(rentangTanggalValid("", "")).toBe(true);
    expect(rentangTanggalValid("2026-07-01", "")).toBe(true);
    expect(rentangTanggalValid("", "2026-07-01")).toBe(true);
    expect(rentangTanggalValid("2026-07-01", "2026-07-01")).toBe(true);
    expect(rentangTanggalValid("2026-07-02", "2026-07-01")).toBe(false);
  });
});

describe("ranking try out nasional tidak menampilkan siswa yang sudah dihapus", () => {
  type Baris = { studentId: string; skorAkhir: number; student: { nama: string; deletedAt: Date | null } };
  const data: Baris[] = [
    { studentId: "a", skorAkhir: 80, student: { nama: "Aku", deletedAt: null } },
    { studentId: "b", skorAkhir: 95, student: { nama: "Siswa Terhapus", deletedAt: new Date("2026-09-01") } },
    { studentId: "c", skorAkhir: 70, student: { nama: "Cici", deletedAt: null } },
  ];

  beforeEach(() => {
    // Meniru database: where.student.deletedAt === null menyaring baris siswa yang sudah dihapus.
    m.attemptFindMany.mockImplementation(async ({ where }: { where: { student?: { deletedAt?: null } } }) =>
      data
        .filter((r) => (where.student?.deletedAt === null ? r.student.deletedAt === null : true))
        .map((r) => ({ studentId: r.studentId, skorAkhir: r.skorAkhir, student: { nama: r.student.nama } })),
    );
  });

  it("siswa terhapus tidak ada di papan, tidak menggeser peringkat, dan tidak dihitung sebagai peserta", async () => {
    const papan = await buildRanking("pkt-1", "a");
    expect(papan).toMatchObject({ peringkatSaya: 1, totalPeserta: 2 });
    expect(papan!.papan.map((r) => r.nama)).toEqual(["Aku", "Cici"]);
    expect((await buildRanking("pkt-1", "c"))!.peringkatSaya).toBe(2);
  });

  it("query memang meminta siswa yang belum dihapus untuk paket itu dengan skor terisi", async () => {
    await buildRanking("pkt-1", "a");
    expect(whereTerakhir()).toEqual({ packageId: "pkt-1", skorAkhir: { not: null }, student: { deletedAt: null } });
  });
});
