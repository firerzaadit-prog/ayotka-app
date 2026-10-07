import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({
  update: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
  groupBy: vi.fn(),
  deleteMany: vi.fn(),
  ringkasanTutor: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    tutorAiPesan: { update: m.update, updateMany: m.updateMany, findMany: m.findMany, groupBy: m.groupBy, deleteMany: m.deleteMany },
  },
}));
vi.mock("@/lib/tutor/penggunaan", () => ({ ringkasanTutor: m.ringkasanTutor }));

import {
  batasSimpan,
  bersihkanBilaPerlu,
  bersihkanRiwayatKedaluwarsa,
  hapusPercakapan,
  infoTutorHalaman,
  muatRiwayat,
  simpanPercakapan,
  soalDenganRiwayat,
} from "@/lib/tutor/penyimpanan";
import { HARI_SIMPAN_RIWAYAT, MAKS_GILIRAN_DIMUAT } from "@/lib/tutor/konstanta";

const SEKARANG = new Date("2026-10-14T05:00:00.000Z");
const HARI = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("aturan 7 hari", () => {
  it("lama simpan yang dijanjikan ke siswa adalah 7 hari", () => {
    expect(HARI_SIMPAN_RIWAYAT).toBe(7);
  });

  it("batasSimpan = tepat 7 x 24 jam sebelum sekarang", () => {
    expect(batasSimpan(SEKARANG).toISOString()).toBe("2026-10-07T05:00:00.000Z");
    expect(SEKARANG.getTime() - batasSimpan(SEKARANG).getTime()).toBe(7 * HARI);
  });
});

describe("simpanPercakapan", () => {
  it("mengisi baris reservasi dengan pesan, balasan, dan penanda foto (bukan fotonya)", async () => {
    m.update.mockResolvedValue({});
    await simpanPercakapan("baris-1", { pesan: "Halo", balasan: "Hai juga", adaFoto: true });
    expect(m.update).toHaveBeenCalledWith({ where: { id: "baris-1" }, data: { pesan: "Halo", balasan: "Hai juga", adaFoto: true } });
  });
});

describe("muatRiwayat", () => {
  const params = { attemptId: "a1", studentId: "s1", questionId: "q1" };
  const baris = (id: string, jam: number) => ({
    id,
    pesan: `tanya ${id}`,
    balasan: `jawab ${id}`,
    adaFoto: id === "b2",
    createdAt: new Date(SEKARANG.getTime() - jam * 3600_000),
  });

  it("hanya membaca milik siswa itu, percobaan itu, soal itu, yang belum lewat 7 hari dan sudah berbalasan", async () => {
    m.findMany.mockResolvedValue([]);
    await muatRiwayat(params, SEKARANG);
    expect(m.findMany).toHaveBeenCalledWith({
      where: {
        attemptId: "a1",
        studentId: "s1",
        questionId: "q1",
        createdAt: { gte: new Date("2026-10-07T05:00:00.000Z") },
        pesan: { not: null },
        balasan: { not: null },
      },
      orderBy: { createdAt: "asc" },
      take: MAKS_GILIRAN_DIMUAT,
      select: { id: true, pesan: true, balasan: true, adaFoto: true, createdAt: true },
    });
  });

  it("satu baris menjadi dua giliran berurutan (siswa lalu tutor) dengan id berbeda dan waktu kirim", async () => {
    m.findMany.mockResolvedValue([baris("b1", 48), baris("b2", 24)]);
    const hasil = await muatRiwayat(params, SEKARANG);
    expect(hasil.map((g) => `${g.role}:${g.content}`)).toEqual(["user:tanya b1", "assistant:jawab b1", "user:tanya b2", "assistant:jawab b2"]);
    expect(hasil.map((g) => g.id)).toEqual(["b1:u", "b1:a", "b2:u", "b2:a"]);
    expect(new Set(hasil.map((g) => g.id)).size).toBe(4);
    expect(hasil[0]!.waktu).toBe(new Date(SEKARANG.getTime() - 48 * 3600_000).toISOString());
  });

  it("penanda foto hanya pada giliran siswa, tidak pernah ada isi foto", async () => {
    m.findMany.mockResolvedValue([baris("b2", 1)]);
    const hasil = await muatRiwayat(params, SEKARANG);
    expect(hasil[0]).toMatchObject({ role: "user", adaFoto: true });
    expect(hasil[1]).toMatchObject({ role: "assistant", adaFoto: false });
    expect(JSON.stringify(hasil)).not.toMatch(/data:image/);
  });

  it("tidak ada riwayat -> daftar kosong", async () => {
    m.findMany.mockResolvedValue([]);
    expect(await muatRiwayat(params, SEKARANG)).toEqual([]);
  });
});

describe("soalDenganRiwayat / infoTutorHalaman", () => {
  it("mengelompokkan per soal dengan batas 7 hari dan hanya yang berbalasan, untuk siswa dan percobaan itu", async () => {
    m.groupBy.mockResolvedValue([{ questionId: "q1" }, { questionId: "q3" }]);
    expect(await soalDenganRiwayat("a1", "s1", SEKARANG)).toEqual(["q1", "q3"]);
    expect(m.groupBy).toHaveBeenCalledWith({
      by: ["questionId"],
      where: {
        attemptId: "a1",
        studentId: "s1",
        createdAt: { gte: new Date("2026-10-07T05:00:00.000Z") },
        pesan: { not: null },
        balasan: { not: null },
      },
    });
  });

  it("infoTutorHalaman menggabungkan ringkasan, soal berriwayat, dan lama simpan", async () => {
    m.ringkasanTutor.mockResolvedValue({ aktif: true, sisaHariIni: 12, batasHarian: 20 });
    m.groupBy.mockResolvedValue([{ questionId: "q9" }]);
    expect(await infoTutorHalaman({ id: "a1", studentId: "s1" }, SEKARANG)).toEqual({
      aktif: true,
      sisaHariIni: 12,
      batasHarian: 20,
      soalBerriwayat: ["q9"],
      hariSimpan: 7,
    });
  });
});

describe("hapusPercakapan (siswa menghapus percakapan satu soal)", () => {
  const params = { attemptId: "a1", studentId: "s1", questionId: "q1" };

  it("mengosongkan pesan, balasan, dan penanda foto HANYA untuk siswa, percobaan, dan soal itu", async () => {
    m.updateMany.mockResolvedValue({ count: 2 });
    expect(await hapusPercakapan(params)).toBe(2);
    expect(m.updateMany).toHaveBeenCalledWith({
      where: {
        attemptId: "a1",
        studentId: "s1",
        questionId: "q1",
        OR: [{ pesan: { not: null } }, { balasan: { not: null } }, { adaFoto: true }],
      },
      data: { pesan: null, balasan: null, adaFoto: false },
    });
  });

  it("BARIS tidak pernah dihapus (baris = dasar batas pesan harian, jatah tidak boleh kembali karena menghapus)", async () => {
    m.updateMany.mockResolvedValue({ count: 3 });
    await hapusPercakapan(params);
    expect(m.deleteMany).not.toHaveBeenCalled();
    const data = m.updateMany.mock.calls[0]![0].data;
    expect(Object.keys(data).sort()).toEqual(["adaFoto", "balasan", "pesan"]);
    expect(data).not.toHaveProperty("createdAt");
    expect(data).not.toHaveProperty("studentId");
  });

  it("tidak ada yang dihapus -> 0", async () => {
    m.updateMany.mockResolvedValue({ count: 0 });
    expect(await hapusPercakapan(params)).toBe(0);
  });
});

describe("pembersihan", () => {
  it("menghapus semua baris yang lebih tua dari 7 hari (semua siswa) dan melaporkan jumlahnya", async () => {
    m.deleteMany.mockResolvedValue({ count: 5 });
    expect(await bersihkanRiwayatKedaluwarsa(SEKARANG)).toBe(5);
    expect(m.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date("2026-10-07T05:00:00.000Z") } } });
  });

  it("batas penghapusan tepat: baris persis 7 hari tidak dihapus (lt), lebih tua sedikit dihapus", async () => {
    m.deleteMany.mockResolvedValue({ count: 0 });
    await bersihkanRiwayatKedaluwarsa(SEKARANG);
    const where = m.deleteMany.mock.calls[0]![0].where.createdAt;
    expect(Object.keys(where)).toEqual(["lt"]);
    expect(where.lt.getTime()).toBe(SEKARANG.getTime() - 7 * HARI);
  });

  it("pembacaan dan penghapusan memakai batas yang SAMA (tidak ada celah: yang tak tampil pasti terhapus)", async () => {
    m.findMany.mockResolvedValue([]);
    m.deleteMany.mockResolvedValue({ count: 0 });
    await muatRiwayat({ attemptId: "a", studentId: "s", questionId: "q" }, SEKARANG);
    await bersihkanRiwayatKedaluwarsa(SEKARANG);
    expect(m.findMany.mock.calls[0]![0].where.createdAt.gte.getTime()).toBe(m.deleteMany.mock.calls[0]![0].where.createdAt.lt.getTime());
  });

  it("bersihkanBilaPerlu: pertama berjalan, dalam jeda tidak, setelah jeda berjalan lagi; kegagalan tidak melempar", async () => {
    m.deleteMany.mockResolvedValue({ count: 0 });
    const t0 = new Date("2031-01-01T00:00:00Z");
    bersihkanBilaPerlu(t0);
    expect(m.deleteMany).toHaveBeenCalledTimes(1);
    bersihkanBilaPerlu(new Date(t0.getTime() + 30 * 60_000));
    expect(m.deleteMany).toHaveBeenCalledTimes(1);
    bersihkanBilaPerlu(new Date(t0.getTime() + 61 * 60_000));
    expect(m.deleteMany).toHaveBeenCalledTimes(2);

    m.deleteMany.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => bersihkanBilaPerlu(new Date(t0.getTime() + 200 * 60_000))).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
