import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const m = vi.hoisted(() => ({ siswa: vi.fn(), paket: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { student: { findUnique: m.siswa }, package: { findUnique: m.paket } } }));

import { muatIdentitasRapor } from "@/lib/exam/identitas-rapor";

const MULAI = new Date("2026-10-12T08:38:00.000Z");
const SELESAI = new Date("2026-10-12T09:12:00.000Z");
const attempt = (o: Record<string, unknown> = {}) => ({ id: "att-1", studentId: "siswa-1", packageId: "71b222eb-472c-4b11-9bc2-170adc610384", assignmentId: null, mulaiAt: MULAI, selesaiAt: SELESAI, ...o });
const paket = (o: Record<string, unknown> = {}) => ({
  id: "71b222eb-472c-4b11-9bc2-170adc610384",
  kategori: "mandiri",
  ownerType: "pusat",
  jenjang: "SD",
  subject: { nama: "Matematika" },
  soalImportLog: { sourcePaketCode: "MAT-SD-PT1" },
  ...o,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.siswa.mockResolvedValue({ school: { nama: "SDN Sukun 3 Malang" } });
  m.paket.mockResolvedValue(paket());
});

describe("muatIdentitasRapor", () => {
  it("memuat asal sekolah, jenis, mata pelajaran, jenjang, kode soal impor, dan waktu ujian", async () => {
    expect(await muatIdentitasRapor(attempt() as never)).toEqual({
      asalSekolah: "SDN Sukun 3 Malang",
      jenisTryOut: "mandiri",
      mataPelajaran: "Matematika",
      jenjang: "SD",
      kodeSoal: "MAT-SD-PT1",
      mulaiAt: MULAI,
      selesaiAt: SELESAI,
    });
    expect(m.siswa).toHaveBeenCalledWith({ where: { id: "siswa-1" }, select: { school: { select: { nama: true } } } });
    expect(m.paket.mock.calls[0]![0].where).toEqual({ id: "71b222eb-472c-4b11-9bc2-170adc610384" });
  });

  it("paket nasional, penugasan sekolah, dan paket milik sekolah menentukan jenisnya", async () => {
    m.paket.mockResolvedValue(paket({ kategori: "nasional" }));
    expect((await muatIdentitasRapor(attempt() as never)).jenisTryOut).toBe("nasional");
    m.paket.mockResolvedValue(paket());
    expect((await muatIdentitasRapor(attempt({ assignmentId: "tugas-1" }) as never)).jenisTryOut).toBe("sekolah");
    m.paket.mockResolvedValue(paket({ ownerType: "sekolah" }));
    expect((await muatIdentitasRapor(attempt() as never)).jenisTryOut).toBe("sekolah");
  });

  it("paket bukan hasil impor: kode dari ID paket", async () => {
    m.paket.mockResolvedValue(paket({ soalImportLog: null }));
    expect((await muatIdentitasRapor(attempt() as never)).kodeSoal).toBe("PKT-71B222EB");
  });

  it("siswa tanpa sekolah atau nama sekolah kosong: asal sekolah null", async () => {
    m.siswa.mockResolvedValue({ school: null });
    expect((await muatIdentitasRapor(attempt() as never)).asalSekolah).toBeNull();
    m.siswa.mockResolvedValue({ school: { nama: "   " } });
    expect((await muatIdentitasRapor(attempt() as never)).asalSekolah).toBeNull();
    m.siswa.mockResolvedValue(null);
    expect((await muatIdentitasRapor(attempt() as never)).asalSekolah).toBeNull();
  });

  it("siswa dan paket tidak ditemukan: tetap mengembalikan identitas minimal, tidak melempar", async () => {
    m.siswa.mockResolvedValue(null);
    m.paket.mockResolvedValue(null);
    const hasil = await muatIdentitasRapor(attempt() as never);
    expect(hasil).toMatchObject({ asalSekolah: null, jenisTryOut: "mandiri", mataPelajaran: null, jenjang: null, kodeSoal: "PKT-71B222EB" });
    expect(hasil.mulaiAt).toBe(MULAI);
  });

  it("waktu selesai belum tercatat: null", async () => {
    expect((await muatIdentitasRapor(attempt({ selesaiAt: null }) as never)).selesaiAt).toBeNull();
  });
});
