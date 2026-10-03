import { describe, expect, it, vi } from "vitest";
import type { PeriodeLangganan } from "@prisma/client";
import {
  akhirEfektif,
  buatPeriode,
  geserTanggal,
  pilihPeriodeAkanDatang,
  pilihPeriodeBerjalan,
  pilihPeriodeRujukan,
  pilihPeriodeTerakhirBerakhir,
  PeriodeTidakValidError,
  statusPeriode,
  tanggalAkhirPeriode,
  ubahPeriode,
  validasiRentangPeriode,
} from "@/lib/billing/periode-sekolah";
import { adalahTanggalKalender, akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

const HARI = 24 * 60 * 60 * 1000;

/** Periode contoh: mulai awal hari WIB, berakhir akhir hari WIB (seperti yang disimpan server). */
function periode(mulai: string, berakhir: string, lain: Partial<PeriodeLangganan> = {}): PeriodeLangganan {
  return {
    id: `p-${mulai}`,
    schoolId: "sch-1",
    nama: null,
    mulai: startOfDayWIB(mulai),
    berakhir: akhirHariWIB(berakhir),
    masaTenggangHari: 14,
    seatQuota: 100,
    catatan: null,
    dicabutAt: null,
    dibuatOlehId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...lain,
  };
}

describe("statusPeriode - batas tepat di zona WIB", () => {
  const p = periode("2026-07-01", "2026-12-31");

  it("akan_datang sampai sebelum awal hari mulai, aktif tepat saat mulai", () => {
    expect(statusPeriode(p, new Date(p.mulai.getTime() - 1))).toBe("akan_datang");
    expect(statusPeriode(p, p.mulai)).toBe("aktif");
  });

  it("aktif sepanjang hari berakhir (sampai 23:59:59.999 WIB), tenggang sesudahnya", () => {
    expect(statusPeriode(p, p.berakhir)).toBe("aktif");
    expect(statusPeriode(p, new Date(p.berakhir.getTime() + 1))).toBe("tenggang");
  });

  it("tenggang tepat sampai akhir masa tenggang, lalu berakhir", () => {
    const batas = akhirEfektif(p);
    expect(batas.getTime()).toBe(p.berakhir.getTime() + 14 * HARI);
    expect(statusPeriode(p, batas)).toBe("tenggang");
    expect(statusPeriode(p, new Date(batas.getTime() + 1))).toBe("berakhir");
  });

  it("tenggang 0 hari: langsung berakhir sesudah hari berakhir", () => {
    const tanpaTenggang = periode("2026-07-01", "2026-12-31", { masaTenggangHari: 0 });
    expect(statusPeriode(tanpaTenggang, new Date(tanpaTenggang.berakhir.getTime() + 1))).toBe("berakhir");
  });

  it("periode yang dicabut selalu 'dicabut', apa pun tanggalnya", () => {
    const dicabut = periode("2026-07-01", "2026-12-31", { dicabutAt: new Date() });
    expect(statusPeriode(dicabut, new Date("2026-08-01T00:00:00Z"))).toBe("dicabut");
  });

  it("'berlaku sampai 31 Desember' benar-benar berlaku sampai malam, bukan putus pukul 07.00 WIB", () => {
    const pukul07WIB = new Date(startOfDayWIB("2026-12-31").getTime() + 7 * 60 * 60 * 1000);
    expect(statusPeriode(p, pukul07WIB)).toBe("aktif");
  });
});

describe("pemilihan periode", () => {
  const p1 = periode("2026-01-01", "2026-06-30");
  const p2 = periode("2026-07-01", "2026-12-31");

  it("tidak ada periode: semua null", () => {
    const sekarang = new Date("2026-03-01T00:00:00Z");
    expect(pilihPeriodeBerjalan([], sekarang)).toBeNull();
    expect(pilihPeriodeAkanDatang([], sekarang)).toBeNull();
    expect(pilihPeriodeTerakhirBerakhir([], sekarang)).toBeNull();
    expect(pilihPeriodeRujukan([], sekarang)).toBeNull();
  });

  it("perpanjangan saat masa tenggang: periode berikutnya yang aktif menang atas periode lama yang masih tenggang", () => {
    const awalP2 = new Date(p2.mulai.getTime() + HARI); // p1 sudah lewat tapi masih dalam tenggang 14 hari
    expect(statusPeriode(p1, awalP2)).toBe("tenggang");
    expect(pilihPeriodeBerjalan([p1, p2], awalP2)?.id).toBe(p2.id);
  });

  it("hanya periode lama yang masih tenggang (periode baru belum mulai): periode lama tetap berjalan", () => {
    const celah = periode("2026-07-10", "2026-12-31"); // mulai 10 Juli, p1 berakhir 30 Juni -> tenggang sampai 14 Juli
    const waktu = new Date(startOfDayWIB("2026-07-05").getTime());
    expect(pilihPeriodeBerjalan([p1, celah], waktu)?.id).toBe(p1.id);
  });

  it("rujukan: berjalan, kalau tidak ada yang akan datang terdekat, kalau tidak yang terakhir berakhir", () => {
    expect(pilihPeriodeRujukan([p1, p2], new Date("2026-03-01T00:00:00Z"))?.id).toBe(p1.id);
    expect(pilihPeriodeRujukan([p1, p2], new Date(p1.berakhir.getTime() + 30 * HARI))?.id).toBe(p2.id); // p2 sudah berjalan
    const jauh = new Date("2028-01-01T00:00:00Z");
    expect(pilihPeriodeRujukan([p1, p2], jauh)?.id).toBe(p2.id); // keduanya berakhir -> yang paling akhir
    expect(pilihPeriodeTerakhirBerakhir([p1, p2], jauh)?.id).toBe(p2.id);
  });

  it("periode yang dicabut tidak pernah dipilih", () => {
    const dicabut = periode("2026-07-01", "2026-12-31", { dicabutAt: new Date() });
    expect(pilihPeriodeBerjalan([dicabut], new Date("2026-08-01T00:00:00Z"))).toBeNull();
  });
});

describe("validasiRentangPeriode", () => {
  const ada = [periode("2026-01-01", "2026-06-30", { id: "a" })];

  it("berakhir sebelum mulai ditolak", () => {
    expect(validasiRentangPeriode([], { mulai: startOfDayWIB("2026-07-02"), berakhir: akhirHariWIB("2026-07-01") })).toMatch(/sebelum/);
  });

  it("satu hari yang sama (mulai = berakhir) sah", () => {
    expect(validasiRentangPeriode([], { mulai: startOfDayWIB("2026-07-01"), berakhir: akhirHariWIB("2026-07-01") })).toBeNull();
  });

  it("tumpang tindih ditolak, termasuk bersinggungan satu hari", () => {
    expect(validasiRentangPeriode(ada, { mulai: startOfDayWIB("2026-06-30"), berakhir: akhirHariWIB("2026-12-31") })).toMatch(/bertabrakan/);
    expect(validasiRentangPeriode(ada, { mulai: startOfDayWIB("2026-03-01"), berakhir: akhirHariWIB("2026-03-02") })).toMatch(/bertabrakan/);
  });

  it("berurutan tanpa celah (mulai sehari setelah berakhir) sah", () => {
    expect(validasiRentangPeriode(ada, { mulai: startOfDayWIB("2026-07-01"), berakhir: akhirHariWIB("2026-12-31") })).toBeNull();
  });

  it("periode yang dicabut tidak dihitung, dan periode sendiri dikecualikan saat mengubah", () => {
    const dicabut = [periode("2026-01-01", "2026-06-30", { id: "x", dicabutAt: new Date() })];
    expect(validasiRentangPeriode(dicabut, { mulai: startOfDayWIB("2026-03-01"), berakhir: akhirHariWIB("2026-04-01") })).toBeNull();
    expect(validasiRentangPeriode(ada, { id: "a", mulai: startOfDayWIB("2026-02-01"), berakhir: akhirHariWIB("2026-07-31") })).toBeNull();
  });
});

describe("helper tanggal kalender", () => {
  it("geserTanggal menggeser murni kalender, melewati batas bulan dan tahun", () => {
    expect(geserTanggal("2026-12-31", 1)).toBe("2027-01-01");
    expect(geserTanggal("2026-03-01", -1)).toBe("2026-02-28");
    expect(geserTanggal("2024-03-01", -1)).toBe("2024-02-29");
    expect(geserTanggal("2026-07-01", 0)).toBe("2026-07-01");
  });

  it("tanggalAkhirPeriode: semester dan setahun dari 1 Juli", () => {
    expect(tanggalAkhirPeriode("2026-07-01", 6)).toBe("2026-12-31");
    expect(tanggalAkhirPeriode("2026-07-01", 12)).toBe("2027-06-30");
    expect(tanggalAkhirPeriode("2027-01-01", 6)).toBe("2027-06-30");
  });

  it("tanggalAkhirPeriode: tanggal 31 ke bulan yang lebih pendek memakai akhir bulan tujuan, tidak melompat", () => {
    expect(tanggalAkhirPeriode("2026-01-31", 1)).toBe("2026-02-27");
    expect(tanggalAkhirPeriode("2024-01-31", 1)).toBe("2024-02-28"); // tahun kabisat
    expect(tanggalAkhirPeriode("2026-08-31", 6)).toBe("2027-02-27");
  });
});

describe("helper tanggal WIB baru", () => {
  it("akhirHariWIB = 23:59:59.999 WIB, satu milidetik sebelum awal hari berikutnya", () => {
    expect(akhirHariWIB("2026-12-31").toISOString()).toBe("2026-12-31T16:59:59.999Z");
    expect(akhirHariWIB("2026-12-31").getTime() + 1).toBe(startOfDayWIB("2027-01-01").getTime());
  });

  it("adalahTanggalKalender menerima tanggal nyata (termasuk 29 Februari kabisat) dan menolak yang tidak ada", () => {
    for (const sah of ["2026-12-31", "2024-02-29", "2026-01-01"]) expect(adalahTanggalKalender(sah)).toBe(true);
    for (const salah of ["2026-02-29", "2026-02-31", "2026-04-31", "2026-13-01", "2026-00-10", "2026-1-5", "31-12-2026", "", "besok"]) {
      expect(adalahTanggalKalender(salah)).toBe(false);
    }
  });
});

/** Database tiruan dalam memori untuk buatPeriode/ubahPeriode. */
function dbTiruan(awal: PeriodeLangganan[] = []) {
  const daftar = [...awal];
  const sekolah: { seatQuota: number | null; validUntil: Date | null } = { seatQuota: null, validUntil: null };
  const updateMassal: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
  const db = {
    periodeLangganan: {
      findMany: vi.fn(async ({ where }: { where: { schoolId: string; dicabutAt?: null } }) =>
        daftar
          .filter((p) => p.schoolId === where.schoolId && (where.dicabutAt === null ? p.dicabutAt === null : true))
          .sort((a, b) => a.mulai.getTime() - b.mulai.getTime()),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => daftar.find((p) => p.id === where.id) ?? null),
      create: vi.fn(async ({ data }: { data: Partial<PeriodeLangganan> }) => {
        const baru = { id: `baru-${daftar.length + 1}`, dicabutAt: null, createdAt: new Date(), ...data } as PeriodeLangganan;
        daftar.push(baru);
        return baru;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<PeriodeLangganan> }) => {
        const p = daftar.find((x) => x.id === where.id)!;
        Object.assign(p, data);
        return p;
      }),
    },
    school: {
      update: vi.fn(async ({ data }: { data: typeof sekolah }) => Object.assign(sekolah, data)),
    },
    entitlement: {
      updateMany: vi.fn(async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        updateMassal.push(args);
        return { count: 0 };
      }),
    },
  };
  return { db: db as never, daftar, sekolah, updateMassal };
}

describe("buatPeriode", () => {
  const sekarang = new Date("2026-08-01T00:00:00Z");
  const input = {
    schoolId: "sch-1",
    mulai: startOfDayWIB("2026-07-01"),
    berakhir: akhirHariWIB("2026-12-31"),
    seatQuota: 120,
  };

  it("membuat periode dengan tenggang bawaan 14 hari, merapikan teks, dan menyalin periode rujukan ke kolom sekolah", async () => {
    const { db, sekolah } = dbTiruan();
    const p = await buatPeriode(db, { ...input, nama: "  Semester Ganjil  ", catatan: "   " }, sekarang);
    expect(p.masaTenggangHari).toBe(14);
    expect(p.nama).toBe("Semester Ganjil");
    expect(p.catatan).toBeNull();
    expect(sekolah).toEqual({ seatQuota: 120, validUntil: input.berakhir });
  });

  it("menolak periode yang tumpang tindih dengan periode lain dan tidak menulis apa pun", async () => {
    const { db, daftar } = dbTiruan([periode("2026-06-01", "2026-09-30", { id: "lama" })]);
    await expect(buatPeriode(db, input, sekarang)).rejects.toBeInstanceOf(PeriodeTidakValidError);
    expect(daftar).toHaveLength(1);
  });

  it("perpanjangan berurutan: periode baru ditambah, riwayat lama tetap, kolom sekolah mengikuti periode yang berjalan", async () => {
    const lama = periode("2026-01-01", "2026-06-30", { id: "lama", seatQuota: 80 });
    const { db, daftar, sekolah } = dbTiruan([lama]);
    await buatPeriode(db, input, sekarang);
    expect(daftar).toHaveLength(2);
    expect(daftar[0]!.berakhir).toEqual(lama.berakhir); // tanggal lama tidak ditimpa
    expect(sekolah.seatQuota).toBe(120);
  });
});

describe("ubahPeriode", () => {
  const sekarang = new Date("2026-08-01T00:00:00Z");

  it("periode tidak ada / sudah dicabut ditolak", async () => {
    const { db } = dbTiruan([periode("2026-07-01", "2026-12-31", { id: "x", dicabutAt: new Date() })]);
    await expect(ubahPeriode(db, "tidak-ada", { seatQuota: 5 }, sekarang)).rejects.toBeInstanceOf(PeriodeTidakValidError);
    await expect(ubahPeriode(db, "x", { seatQuota: 5 }, sekarang)).rejects.toThrow(/dicabut/);
  });

  it("mengubah tanggal berakhir/tenggang menggeser batas kursi siswa yang masih berlaku ke akhir efektif yang baru", async () => {
    const { db, updateMassal } = dbTiruan([periode("2026-07-01", "2026-12-31", { id: "p" })]);
    const baru = await ubahPeriode(db, "p", { berakhir: akhirHariWIB("2027-02-28"), masaTenggangHari: 7 }, sekarang);
    expect(updateMassal).toHaveLength(1);
    expect(updateMassal[0]!.where).toEqual({ periodeId: "p", source: "school_seat", revokedAt: null });
    expect(updateMassal[0]!.data).toEqual({ endsAt: new Date(akhirHariWIB("2027-02-28").getTime() + 7 * HARI) });
    expect(baru.masaTenggangHari).toBe(7);
  });

  it("mengubah rentang menjadi tumpang tindih dengan periode lain ditolak, tetapi tidak bentrok dengan dirinya sendiri", async () => {
    const { db } = dbTiruan([
      periode("2026-01-01", "2026-06-30", { id: "a" }),
      periode("2026-07-01", "2026-12-31", { id: "b" }),
    ]);
    await expect(ubahPeriode(db, "b", { mulai: startOfDayWIB("2026-06-15") }, sekarang)).rejects.toBeInstanceOf(PeriodeTidakValidError);
    await expect(ubahPeriode(db, "b", { berakhir: akhirHariWIB("2027-03-31") }, sekarang)).resolves.toBeTruthy();
  });

  it("mencabut periode: tandai dicabut, cabut semua kursinya, dan kosongkan kolom sekolah bila tidak ada periode lain", async () => {
    const { db, daftar, sekolah, updateMassal } = dbTiruan([periode("2026-07-01", "2026-12-31", { id: "p" })]);
    sekolah.seatQuota = 100;
    const dicabut = await ubahPeriode(db, "p", { dicabut: true }, sekarang);
    expect(dicabut.dicabutAt).toEqual(sekarang);
    expect(daftar[0]!.dicabutAt).toEqual(sekarang);
    expect(updateMassal[0]!.where).toEqual({ periodeId: "p", revokedAt: null });
    expect(updateMassal[0]!.data).toEqual({ revokedAt: sekarang });
    expect(sekolah).toEqual({ seatQuota: null, validUntil: null });
  });
});
