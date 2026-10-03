import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Siswa = { id: string; schoolId: string | null; jalur: "A" | "B"; deletedAt: Date | null; lulusAt: Date | null };
type Periode = {
  id: string;
  schoolId: string;
  mulai: Date;
  berakhir: Date;
  masaTenggangHari: number;
  seatQuota: number;
  dicabutAt: Date | null;
};
type Kursi = {
  id: string;
  studentId: string;
  periodeId: string | null;
  schoolId: string | null;
  source: string;
  startsAt: Date;
  endsAt: Date;
  revokedAt: Date | null;
  planId: string;
};

/** Penyimpanan tiruan dalam memori; berperilaku seperti tabel sungguhan (termasuk batas unik siswa+periode). */
const s = vi.hoisted(() => ({
  siswa: [] as Siswa[],
  periode: [] as Periode[],
  kursi: [] as Kursi[],
  jumlahAttempt: 0,
  gagalBuatSekali: false,
  nomor: 0,
}));

vi.mock("@/lib/db/prisma", async () => {
  const { Prisma: P } = await import("@prisma/client");
  // Sama seperti filter hitungKursiPeriode: siswa yang dihapus ATAU sudah lulus tidak dihitung.
  const hidup = (id: string) => s.siswa.find((x) => x.id === id && x.deletedAt === null && x.lulusAt === null) !== undefined;
  return {
    prisma: {
      student: {
        findUnique: async ({ where }: { where: { id: string } }) => s.siswa.find((x) => x.id === where.id) ?? null,
      },
      periodeLangganan: {
        findMany: async ({ where }: { where: { schoolId: string; dicabutAt?: null } }) =>
          s.periode.filter((p) => p.schoolId === where.schoolId && (where.dicabutAt === null ? p.dicabutAt === null : true)),
      },
      plan: {
        findFirst: async () => ({ id: "plan-sekolah", kode: "school", fitur: { aiKuotaPerMapel: 1, tryOutNasionalKuotaPerMapel: 3 } }),
      },
      attempt: { count: async () => s.jumlahAttempt },
      entitlement: {
        findUnique: async ({ where }: { where: { studentId_periodeId: { studentId: string; periodeId: string } } }) => {
          const k = where.studentId_periodeId;
          return s.kursi.find((e) => e.studentId === k.studentId && e.periodeId === k.periodeId) ?? null;
        },
        findFirst: async ({ where }: { where: { studentId: string; revokedAt: null; startsAt: { lte: Date } } }) =>
          s.kursi
            .filter((e) => e.studentId === where.studentId && e.revokedAt === null && e.startsAt <= where.startsAt.lte)
            .sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0] ?? null,
        count: async ({ where }: { where: { periodeId: string } }) =>
          s.kursi.filter((e) => e.periodeId === where.periodeId && e.source === "school_seat" && e.revokedAt === null && hidup(e.studentId)).length,
        create: async ({ data }: { data: Omit<Kursi, "id" | "revokedAt"> }) => {
          if (s.gagalBuatSekali) {
            // Simulasi balapan: permintaan lain sudah membuat kursi yang sama tepat sebelum ini.
            s.gagalBuatSekali = false;
            s.kursi.push({ ...data, id: `k${++s.nomor}`, revokedAt: null });
            throw new P.PrismaClientKnownRequestError("duplikat", { code: "P2002", clientVersion: "test" });
          }
          if (s.kursi.some((e) => e.studentId === data.studentId && e.periodeId === data.periodeId && data.periodeId !== null)) {
            throw new P.PrismaClientKnownRequestError("duplikat", { code: "P2002", clientVersion: "test" });
          }
          const baru = { ...data, id: `k${++s.nomor}`, revokedAt: null };
          s.kursi.push(baru);
          return baru;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Kursi> }) => {
          const k = s.kursi.find((e) => e.id === where.id)!;
          Object.assign(k, data);
          return k;
        },
      },
    },
  };
});

import {
  canStartAttempt,
  grantSchoolSeatIfAvailable,
  kursiSekolahTersedia,
} from "@/lib/billing/entitlements";
import { akhirEfektif } from "@/lib/billing/periode-sekolah";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

const SEKOLAH = "sch-1";

function periode(id: string, mulai: string, berakhir: string, seatQuota: number, lain: Partial<Periode> = {}): Periode {
  return {
    id,
    schoolId: SEKOLAH,
    mulai: startOfDayWIB(mulai),
    berakhir: akhirHariWIB(berakhir),
    masaTenggangHari: 14,
    seatQuota,
    dicabutAt: null,
    ...lain,
  };
}
function siswa(id: string, lain: Partial<Siswa> = {}): Siswa {
  return { id, schoolId: SEKOLAH, jalur: "A", deletedAt: null, lulusAt: null, ...lain };
}
const maju = (tanggal: string) => vi.setSystemTime(new Date(`${tanggal}T05:00:00Z`)); // 12.00 WIB

beforeEach(() => {
  s.siswa = [];
  s.periode = [];
  s.kursi = [];
  s.jumlahAttempt = 0;
  s.gagalBuatSekali = false;
  s.nomor = 0;
  vi.useFakeTimers();
  maju("2026-03-01");
});
afterEach(() => vi.useRealTimers());

describe("grantSchoolSeatIfAvailable - siapa yang berhak", () => {
  beforeEach(() => {
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 10)];
  });

  it.each([
    ["siswa tidak ada", () => {}],
    ["siswa mandiri (Jalur B) walau mencatat sekolah itu", () => s.siswa.push(siswa("a", { jalur: "B" }))],
    ["siswa sudah dihapus", () => s.siswa.push(siswa("a", { deletedAt: new Date() }))],
    ["siswa milik sekolah lain", () => s.siswa.push(siswa("a", { schoolId: "sch-lain" }))],
  ])("%s -> not_eligible dan tidak ada kursi dibuat", async (_nama, siapkan) => {
    siapkan();
    expect(await grantSchoolSeatIfAvailable("a", SEKOLAH)).toEqual({ granted: false, reason: "not_eligible" });
    expect(s.kursi).toHaveLength(0);
  });

  it("alumni (sudah ditandai lulus) -> reason alumni dan tidak mendapat kursi baru", async () => {
    s.siswa.push(siswa("a", { lulusAt: new Date("2026-02-01T00:00:00Z") }));
    expect(await grantSchoolSeatIfAvailable("a", SEKOLAH)).toEqual({ granted: false, reason: "alumni" });
    expect(s.kursi).toHaveLength(0);
  });
});

describe("grantSchoolSeatIfAvailable - keadaan periode", () => {
  beforeEach(() => s.siswa.push(siswa("a")));

  it("sekolah belum pernah punya periode -> not_activated", async () => {
    expect(await grantSchoolSeatIfAvailable("a", SEKOLAH)).toEqual({ granted: false, reason: "not_activated" });
  });

  it("semua periode sudah lewat termasuk tenggang -> period_ended membawa tanggal berakhir", async () => {
    s.periode = [periode("p1", "2025-07-01", "2025-12-31", 10)];
    const hasil = await grantSchoolSeatIfAvailable("a", SEKOLAH);
    expect(hasil).toEqual({ granted: false, reason: "period_ended", berakhir: s.periode[0]!.berakhir });
  });

  it("hanya ada periode yang belum mulai -> period_not_started", async () => {
    s.periode = [periode("p2", "2026-07-01", "2026-12-31", 10)];
    expect(await grantSchoolSeatIfAvailable("a", SEKOLAH)).toEqual({
      granted: false,
      reason: "period_not_started",
      mulai: s.periode[0]!.mulai,
    });
  });

  it("periode yang dicabut diabaikan", async () => {
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 10, { dicabutAt: new Date() })];
    expect(await grantSchoolSeatIfAvailable("a", SEKOLAH)).toEqual({ granted: false, reason: "not_activated" });
  });

  it("masa tenggang: kursi masih diberikan sesudah tanggal berakhir, berlaku sampai akhir tenggang", async () => {
    s.periode = [periode("p1", "2026-01-01", "2026-02-28", 10)]; // 1 Maret = hari pertama tenggang
    const hasil = await grantSchoolSeatIfAvailable("a", SEKOLAH);
    expect(hasil.granted).toBe(true);
    if (hasil.granted) expect(hasil.entitlement.endsAt).toEqual(akhirEfektif(s.periode[0]!));
  });
});

describe("grantSchoolSeatIfAvailable - pemberian kursi", () => {
  beforeEach(() => {
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 2)];
    s.siswa = [siswa("a"), siswa("b"), siswa("c")];
  });

  it("membuat kursi terikat periode, mulai sekarang, berlaku sampai akhir efektif periode", async () => {
    const hasil = await grantSchoolSeatIfAvailable("a", SEKOLAH);
    expect(hasil.granted).toBe(true);
    expect(s.kursi).toHaveLength(1);
    expect(s.kursi[0]).toMatchObject({
      studentId: "a",
      periodeId: "p1",
      schoolId: SEKOLAH,
      source: "school_seat",
      startsAt: new Date("2026-03-01T05:00:00Z"),
      endsAt: akhirEfektif(s.periode[0]!),
    });
  });

  it("idempoten: dipanggil dua kali tetap satu kursi", async () => {
    await grantSchoolSeatIfAvailable("a", SEKOLAH);
    await grantSchoolSeatIfAvailable("a", SEKOLAH);
    expect(s.kursi).toHaveLength(1);
  });

  it("kuota per periode: siswa ketiga mendapat seat_full, dan lega lagi begitu satu siswa dihapus", async () => {
    await grantSchoolSeatIfAvailable("a", SEKOLAH);
    await grantSchoolSeatIfAvailable("b", SEKOLAH);
    expect(await grantSchoolSeatIfAvailable("c", SEKOLAH)).toEqual({ granted: false, reason: "seat_full" });

    s.siswa.find((x) => x.id === "a")!.deletedAt = new Date();
    expect((await grantSchoolSeatIfAvailable("c", SEKOLAH)).granted).toBe(true);
  });

  it("siswa yang lulus membebaskan kursi untuk siswa lain, tanpa menghapus datanya", async () => {
    await grantSchoolSeatIfAvailable("a", SEKOLAH);
    await grantSchoolSeatIfAvailable("b", SEKOLAH);
    expect(await grantSchoolSeatIfAvailable("c", SEKOLAH)).toEqual({ granted: false, reason: "seat_full" });

    s.siswa.find((x) => x.id === "a")!.lulusAt = new Date("2026-03-01T00:00:00Z");
    expect((await grantSchoolSeatIfAvailable("c", SEKOLAH)).granted).toBe(true);
  });

  it("siswa yang sudah punya kursi tetap dilayani walau kuota penuh (tidak kehilangan kursinya)", async () => {
    await grantSchoolSeatIfAvailable("a", SEKOLAH);
    await grantSchoolSeatIfAvailable("b", SEKOLAH);
    expect((await grantSchoolSeatIfAvailable("a", SEKOLAH)).granted).toBe(true);
  });

  it("kursi yang batasnya lebih awal dari akhir efektif periode (data lama / periode diperpanjang) disamakan", async () => {
    s.kursi.push({
      id: "lama",
      studentId: "a",
      periodeId: "p1",
      schoolId: SEKOLAH,
      source: "school_seat",
      startsAt: new Date("2026-01-05T00:00:00Z"),
      endsAt: new Date("2026-06-30T00:00:00Z"),
      revokedAt: null,
      planId: "plan-sekolah",
    });
    const hasil = await grantSchoolSeatIfAvailable("a", SEKOLAH);
    expect(hasil.granted).toBe(true);
    expect(s.kursi).toHaveLength(1);
    expect(s.kursi[0]!.endsAt).toEqual(akhirEfektif(s.periode[0]!));
  });

  it("kursi yang pernah dicabut dihidupkan lagi (bukan dibuat baru yang menabrak batas unik)", async () => {
    s.kursi.push({
      id: "dicabut",
      studentId: "a",
      periodeId: "p1",
      schoolId: SEKOLAH,
      source: "school_seat",
      startsAt: new Date("2026-01-05T00:00:00Z"),
      endsAt: new Date("2026-07-14T00:00:00Z"),
      revokedAt: new Date("2026-02-01T00:00:00Z"),
      planId: "plan-sekolah",
    });
    const hasil = await grantSchoolSeatIfAvailable("a", SEKOLAH);
    expect(hasil.granted).toBe(true);
    expect(s.kursi).toHaveLength(1);
    expect(s.kursi[0]!.revokedAt).toBeNull();
  });

  it("kursi yang dicabut tetap menghormati kuota saat dihidupkan lagi", async () => {
    await grantSchoolSeatIfAvailable("b", SEKOLAH);
    await grantSchoolSeatIfAvailable("c", SEKOLAH);
    s.kursi.push({
      id: "dicabut",
      studentId: "a",
      periodeId: "p1",
      schoolId: SEKOLAH,
      source: "school_seat",
      startsAt: new Date("2026-01-05T00:00:00Z"),
      endsAt: new Date("2026-07-14T00:00:00Z"),
      revokedAt: new Date("2026-02-01T00:00:00Z"),
      planId: "plan-sekolah",
    });
    expect(await grantSchoolSeatIfAvailable("a", SEKOLAH)).toEqual({ granted: false, reason: "seat_full" });
    expect(s.kursi.find((k) => k.id === "dicabut")!.revokedAt).not.toBeNull();
  });

  it("dua permintaan serentak untuk siswa yang sama: yang kalah balapan memakai kursi yang sudah jadi", async () => {
    s.gagalBuatSekali = true;
    const hasil = await grantSchoolSeatIfAvailable("a", SEKOLAH);
    expect(hasil.granted).toBe(true);
    expect(s.kursi).toHaveLength(1);
  });
});

describe("REGRESI perpanjangan: siswa lama tidak boleh kena kuota penuh di periode baru", () => {
  it("kuota 3 dengan 3 siswa lama: setelah periode baru (kuota sama) ketiganya tetap mendapat kursi", async () => {
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 3), periode("p2", "2026-07-01", "2026-12-31", 3)];
    s.siswa = [siswa("a"), siswa("b"), siswa("c"), siswa("d")];

    // Semester pertama: tiga siswa memakai kursi.
    maju("2026-03-01");
    for (const id of ["a", "b", "c"]) expect((await grantSchoolSeatIfAvailable(id, SEKOLAH)).granted).toBe(true);
    expect(await grantSchoolSeatIfAvailable("d", SEKOLAH)).toEqual({ granted: false, reason: "seat_full" });

    // Semester kedua (periode baru): kursi lama sudah tidak dihitung; semua siswa lama mendapat kursi baru.
    maju("2026-08-15");
    for (const id of ["a", "b", "c"]) {
      const hasil = await grantSchoolSeatIfAvailable(id, SEKOLAH);
      expect(hasil.granted).toBe(true);
      if (hasil.granted) expect(hasil.entitlement.periodeId).toBe("p2");
    }
    // Kuota periode baru tetap dihormati.
    expect(await grantSchoolSeatIfAvailable("d", SEKOLAH)).toEqual({ granted: false, reason: "seat_full" });
    // Riwayat kursi periode lama utuh, tidak ditimpa.
    expect(s.kursi.filter((k) => k.periodeId === "p1")).toHaveLength(3);
    expect(s.kursi.filter((k) => k.periodeId === "p2")).toHaveLength(3);
  });

  it("siswa lulus (dihapus) membebaskan kursi di periode baru untuk siswa baru", async () => {
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 2), periode("p2", "2026-07-01", "2026-12-31", 2)];
    s.siswa = [siswa("a"), siswa("b"), siswa("baru")];
    maju("2026-03-01");
    await grantSchoolSeatIfAvailable("a", SEKOLAH);
    await grantSchoolSeatIfAvailable("b", SEKOLAH);

    s.siswa.find((x) => x.id === "b")!.deletedAt = new Date(); // lulus, dihapus
    maju("2026-08-15");
    expect((await grantSchoolSeatIfAvailable("a", SEKOLAH)).granted).toBe(true);
    expect((await grantSchoolSeatIfAvailable("baru", SEKOLAH)).granted).toBe(true);
  });
});

describe("canStartAttempt - alasan penolakan", () => {
  beforeEach(() => s.siswa.push(siswa("a")));

  it("siswa sekolah dengan periode aktif dan kursi tersedia -> boleh (school_seat)", async () => {
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 5)];
    expect(await canStartAttempt("a", "mapel", SEKOLAH)).toEqual({ allowed: true, reason: "school_seat" });
  });

  it("sudah punya kursi aktif -> boleh (entitlement)", async () => {
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 5)];
    await grantSchoolSeatIfAvailable("a", SEKOLAH);
    expect(await canStartAttempt("a", "mapel", SEKOLAH)).toEqual({ allowed: true, reason: "entitlement" });
  });

  it("sekolah dibekukan (periode lewat) dan jatah gratis mapel sudah dipakai -> sekolah_berakhir dengan tanggalnya", async () => {
    s.periode = [periode("p1", "2025-07-01", "2025-12-31", 5)];
    s.jumlahAttempt = 3;
    const hasil = await canStartAttempt("a", "mapel", SEKOLAH);
    expect(hasil).toEqual({ allowed: false, reason: "sekolah_berakhir", berakhir: s.periode[0]!.berakhir });
  });

  it("sekolah dibekukan tetapi jatah gratis mapel belum dipakai -> tetap boleh (free_trial)", async () => {
    s.periode = [periode("p1", "2025-07-01", "2025-12-31", 5)];
    expect(await canStartAttempt("a", "mapel", SEKOLAH)).toEqual({ allowed: true, reason: "free_trial" });
  });

  it("kuota penuh -> waiting_for_seat (otomatis pulih begitu kuota ditambah)", async () => {
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 1)];
    s.siswa.push(siswa("b"));
    await grantSchoolSeatIfAvailable("b", SEKOLAH);
    s.jumlahAttempt = 2;
    expect(await canStartAttempt("a", "mapel", SEKOLAH)).toEqual({ allowed: false, reason: "waiting_for_seat" });
  });

  it("periode belum mulai -> sekolah_belum_mulai", async () => {
    s.periode = [periode("p2", "2026-07-01", "2026-12-31", 5)];
    s.jumlahAttempt = 2;
    expect(await canStartAttempt("a", "mapel", SEKOLAH)).toEqual({ allowed: false, reason: "sekolah_belum_mulai", mulai: s.periode[0]!.mulai });
  });

  it("siswa mandiri (Jalur B) dengan sekolah asal yang dibekukan: butuh langganan sendiri, BUKAN pesan sekolah berakhir", async () => {
    s.siswa = [siswa("m", { jalur: "B" })];
    s.periode = [periode("p1", "2025-07-01", "2025-12-31", 5)];
    s.jumlahAttempt = 2;
    expect(await canStartAttempt("m", "mapel", SEKOLAH)).toEqual({ allowed: false, reason: "quota_required" });
  });

  it("alumni dari sekolah yang masih berlangganan: reason alumni (bukan 'beli paket' yang buntu)", async () => {
    s.siswa = [siswa("a", { lulusAt: new Date("2026-02-01T00:00:00Z") })];
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 5)];
    s.jumlahAttempt = 3;
    expect(await canStartAttempt("a", "mapel", SEKOLAH)).toEqual({ allowed: false, reason: "alumni" });
  });

  it("alumni yang belum memakai jatah gratis mapel tetap boleh free_trial", async () => {
    s.siswa = [siswa("a", { lulusAt: new Date("2026-02-01T00:00:00Z") })];
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 5)];
    expect(await canStartAttempt("a", "mapel", SEKOLAH)).toEqual({ allowed: true, reason: "free_trial" });
  });

  it("tanpa sekolah -> quota_required", async () => {
    s.siswa = [siswa("m", { schoolId: null, jalur: "B" })];
    s.jumlahAttempt = 2;
    expect(await canStartAttempt("m", "mapel", null)).toEqual({ allowed: false, reason: "quota_required" });
  });
});

describe("kursiSekolahTersedia (tanpa efek samping)", () => {
  beforeEach(() => {
    s.periode = [periode("p1", "2026-01-01", "2026-06-30", 1)];
    s.siswa = [siswa("a"), siswa("b")];
  });

  it("true bila ada ruang, dan tidak membuat kursi", async () => {
    expect(await kursiSekolahTersedia(siswa("a"))).toBe(true);
    expect(s.kursi).toHaveLength(0);
  });

  it("false bila kuota penuh untuk siswa lain, true untuk pemilik kursi", async () => {
    await grantSchoolSeatIfAvailable("a", SEKOLAH);
    expect(await kursiSekolahTersedia(siswa("b"))).toBe(false);
    expect(await kursiSekolahTersedia(siswa("a"))).toBe(true);
  });

  it("false untuk Jalur B, siswa dihapus, tanpa sekolah, atau saat sekolah dibekukan", async () => {
    expect(await kursiSekolahTersedia(siswa("x", { jalur: "B" }))).toBe(false);
    expect(await kursiSekolahTersedia(siswa("x", { deletedAt: new Date() }))).toBe(false);
    expect(await kursiSekolahTersedia(siswa("x", { schoolId: null }))).toBe(false);
    expect(await kursiSekolahTersedia(siswa("x", { lulusAt: new Date() }))).toBe(false);
    maju("2027-03-01");
    expect(await kursiSekolahTersedia(siswa("a"))).toBe(false);
  });
});

