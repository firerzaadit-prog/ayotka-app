import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

vi.mock("server-only", () => ({}));

import { sinkronkanIndikatorSoal } from "@/lib/indikator/sinkron-soal";
import { kunciTeksIndikator } from "@/lib/indikator/normalisasi";

const MASTER = [
  { id: "m-smp-mat-1", jenjang: "SMP", namaMapel: "Matematika", teksKunci: kunciTeksIndikator("Menyelesaikan operasi bilangan bentuk pangkat (1)") },
  { id: "m-smp-mat-2", jenjang: "SMP", namaMapel: "Matematika", teksKunci: kunciTeksIndikator("Menentukan nilai rata-rata data (2)") },
  { id: "m-sd-mat-1", jenjang: "SD", namaMapel: "Matematika", teksKunci: kunciTeksIndikator("Menentukan representasi pecahan dari bagian suatu objek utuh. (1)") },
  { id: "m-smp-bin-12", jenjang: "SMP", namaMapel: "Bahasa Indonesia", teksKunci: kunciTeksIndikator("Menilai ketepatan antara ilustrasi dengan isi teks. (12)") },
];

type Soal = { id: string; teks: string; indikatorId: string | null; indikatorTeks: string | null };
type Impor = {
  sourcePaketId: string;
  sourcePaketCode: string;
  package: { id: string; nama: string; jenjang: "SD" | "SMP"; subject: { nama: string } };
};

function buatDb(opsi: { master?: typeof MASTER; impor: Impor[]; soalPerPaket: Record<string, Soal[]> }) {
  const updateMany = vi.fn((arg: unknown) => ({ jenis: "updateMany", arg }));
  const transaksi = vi.fn(async (ops: unknown[]) => ops);
  const findSoal = vi.fn(async ({ where }: { where: { packageId: string } }) => opsi.soalPerPaket[where.packageId] ?? []);
  const db = {
    indikatorResmi: { findMany: vi.fn(async () => opsi.master ?? MASTER) },
    soalImportLog: { findMany: vi.fn(async () => opsi.impor) },
    question: { findMany: findSoal, updateMany },
    $transaction: transaksi,
  } as unknown as PrismaClient;
  return { db, updateMany, transaksi, findSoal };
}

const paketSmpMat: Impor = {
  sourcePaketId: "src-1",
  sourcePaketCode: "A01-SMP-MAT",
  package: { id: "p1", nama: "Paket A1", jenjang: "SMP", subject: { nama: "Matematika" } },
};

const sumber = [
  { teks: "Soal satu", indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)" },
  { teks: "Soal dua", indikator: "  menentukan NILAI rata-rata data   (2)" },
  { teks: "Soal tiga", indikator: "Indikator bebas buatan generator (1)" },
  { teks: "Soal empat", indikator: null },
];

describe("sinkronkanIndikatorSoal", () => {
  it("master belum diunggah: tidak memproses apa pun dan tidak menyentuh sumber", async () => {
    const { db, updateMany } = buatDb({ master: [], impor: [paketSmpMat], soalPerPaket: {} });
    const ambil = vi.fn();
    const r = await sinkronkanIndikatorSoal(db, ambil);
    expect(r.masterKosong).toBe(true);
    expect(r.paket).toEqual([]);
    expect(ambil).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("mengisi teks indikator dari sumber lewat teks soal yang sama, lalu menautkan yang cocok persis ke master", async () => {
    const soal: Soal[] = [
      { id: "q1", teks: "Soal satu", indikatorId: null, indikatorTeks: null },
      { id: "q2", teks: "Soal dua", indikatorId: null, indikatorTeks: null },
      { id: "q3", teks: "Soal tiga", indikatorId: null, indikatorTeks: null },
      { id: "q4", teks: "Soal empat", indikatorId: null, indikatorTeks: null },
      { id: "q5", teks: "Soal yang sudah diedit admin", indikatorId: null, indikatorTeks: null },
    ];
    const { db, updateMany, transaksi } = buatDb({ impor: [paketSmpMat], soalPerPaket: { p1: soal } });
    const r = await sinkronkanIndikatorSoal(db, async () => sumber);

    expect(r.masterKosong).toBe(false);
    expect(r.paket[0]).toMatchObject({
      soal: 5,
      sudahTertaut: 0,
      terisiDariSumber: 3, // q1, q2, q3 (q4 sumbernya tanpa indikator, q5 teksnya tak ada di sumber)
      baruTertaut: 2, // q1 dan q2 cocok persis dengan master; q2 walau beda spasi/huruf besar
      diLuarResmi: 1, // q3: indikator bebas
      tidakBisaDicocokkan: 1, // q5
      sumberTanpaIndikator: 1, // q4
      galatSumber: null,
    });
    expect(transaksi).toHaveBeenCalledTimes(1);
    const panggilan = updateMany.mock.calls.map((c) => c[0] as { where: Record<string, unknown>; data: Record<string, unknown> });
    expect(panggilan).toHaveLength(3);
    const q1 = panggilan.find((p) => (p.where.id as { in: string[] }).in.includes("q1"))!;
    expect(q1.data).toEqual({ indikatorTeks: "Menyelesaikan operasi bilangan bentuk pangkat (1)", indikatorId: "m-smp-mat-1" });
    const q2 = panggilan.find((p) => (p.where.id as { in: string[] }).in.includes("q2"))!;
    expect(q2.data.indikatorId).toBe("m-smp-mat-2");
    const q3 = panggilan.find((p) => (p.where.id as { in: string[] }).in.includes("q3"))!;
    expect(q3.data).toEqual({ indikatorTeks: "Indikator bebas buatan generator (1)" }); // tanpa indikatorId: bukan indikator resmi
  });

  it("setiap pembaruan BERSYARAT pada kolom yang masih kosong (tidak menimpa hasil proses lain)", async () => {
    const soal: Soal[] = [{ id: "q1", teks: "Soal satu", indikatorId: null, indikatorTeks: null }];
    const { db, updateMany } = buatDb({ impor: [paketSmpMat], soalPerPaket: { p1: soal } });
    await sinkronkanIndikatorSoal(db, async () => sumber);
    expect(updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: { in: ["q1"] }, indikatorTeks: null, indikatorId: null } });
  });

  it("soal yang sudah punya indikator tidak ditimpa dan tidak memicu pembacaan sumber", async () => {
    const soal: Soal[] = [{ id: "q1", teks: "Soal satu", indikatorId: "m-smp-mat-1", indikatorTeks: "Menyelesaikan operasi bilangan bentuk pangkat (1)" }];
    const { db, updateMany } = buatDb({ impor: [paketSmpMat], soalPerPaket: { p1: soal } });
    const ambil = vi.fn(async () => sumber);
    const r = await sinkronkanIndikatorSoal(db, ambil);
    expect(ambil).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(r.paket[0]).toMatchObject({ sudahTertaut: 1, terisiDariSumber: 0, baruTertaut: 0, diLuarResmi: 0 });
  });

  it("master diunggah SESUDAH impor: soal yang sudah punya teks indikator ditautkan tanpa membaca sumber", async () => {
    const soal: Soal[] = [
      { id: "q1", teks: "Soal satu", indikatorId: null, indikatorTeks: "Menentukan nilai rata-rata data (2)" },
      { id: "q2", teks: "Soal dua", indikatorId: null, indikatorTeks: "Bebas (3)" },
    ];
    const { db, updateMany } = buatDb({ impor: [paketSmpMat], soalPerPaket: { p1: soal } });
    const ambil = vi.fn(async () => sumber);
    const r = await sinkronkanIndikatorSoal(db, ambil);
    expect(ambil).not.toHaveBeenCalled();
    expect(r.paket[0]).toMatchObject({ baruTertaut: 1, diLuarResmi: 1, terisiDariSumber: 0 });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0]![0]).toEqual({ where: { id: { in: ["q1"] }, indikatorId: null }, data: { indikatorId: "m-smp-mat-2" } });
  });

  it("jenjang paket menentukan master: teks SD tidak tertaut pada paket SMP, dan sebaliknya", async () => {
    const paketSd: Impor = { sourcePaketId: "src-2", sourcePaketCode: "A05-SD-MAT", package: { id: "p2", nama: "Paket A5", jenjang: "SD", subject: { nama: "Matematika" } } };
    const soalSd: Soal[] = [
      { id: "s1", teks: "Pecahan", indikatorId: null, indikatorTeks: "Menentukan representasi pecahan dari bagian suatu objek utuh. (1)" },
      { id: "s2", teks: "Pangkat", indikatorId: null, indikatorTeks: "Menyelesaikan operasi bilangan bentuk pangkat (1)" }, // indikator SMP pada paket SD
    ];
    const { db, updateMany } = buatDb({ impor: [paketSd], soalPerPaket: { p2: soalSd } });
    const r = await sinkronkanIndikatorSoal(db, async () => []);
    expect(r.paket[0]).toMatchObject({ baruTertaut: 1, diLuarResmi: 1 });
    // SOAL YANG MANA yang tertaut ke INDIKATOR YANG MANA, bukan hanya jumlahnya
    const panggilan = updateMany.mock.calls.map((c) => c[0] as { where: { id: { in: string[] } }; data: Record<string, unknown> });
    expect(panggilan).toEqual([{ where: { id: { in: ["s1"] }, indikatorId: null }, data: { indikatorId: "m-sd-mat-1" } }]);
  });

  it("mapel paket menentukan master: indikator Bahasa Indonesia tertaut pada paket Bahasa Indonesia, bukan pada paket Matematika", async () => {
    const paketBin: Impor = { sourcePaketId: "src-3", sourcePaketCode: "A01-SMP-BIN", package: { id: "p3", nama: "Paket B1", jenjang: "SMP", subject: { nama: "Bahasa Indonesia" } } };
    const soalBin: Soal[] = [
      { id: "b1", teks: "Ilustrasi", indikatorId: null, indikatorTeks: "Menilai ketepatan antara ilustrasi dengan isi teks. (12)" },
      { id: "b2", teks: "Pangkat", indikatorId: null, indikatorTeks: "Menyelesaikan operasi bilangan bentuk pangkat (1)" }, // indikator Matematika di paket Bahasa
    ];
    const { db, updateMany } = buatDb({ impor: [paketBin], soalPerPaket: { p3: soalBin } });
    const r = await sinkronkanIndikatorSoal(db, async () => []);
    expect(r.paket[0]).toMatchObject({ baruTertaut: 1, diLuarResmi: 1 });
    const panggilan = updateMany.mock.calls.map((c) => c[0]);
    expect(panggilan).toEqual([{ where: { id: { in: ["b1"] }, indikatorId: null }, data: { indikatorId: "m-smp-bin-12" } }]);
  });

  it("sumber tidak bisa dibaca: paket itu dilaporkan galat, paket lain tetap diproses", async () => {
    const paket2: Impor = { ...paketSmpMat, sourcePaketId: "src-9", sourcePaketCode: "A09-SMP-MAT", package: { ...paketSmpMat.package, id: "p9", nama: "Paket A9" } };
    const { db } = buatDb({
      impor: [paketSmpMat, paket2],
      soalPerPaket: {
        p1: [{ id: "q1", teks: "Soal satu", indikatorId: null, indikatorTeks: null }],
        p9: [{ id: "q9", teks: "Soal satu", indikatorId: null, indikatorTeks: null }],
      },
    });
    const ambil = vi.fn(async (id: string) => {
      if (id === "src-1") throw new Error("koneksi ke Supabase gagal");
      return sumber;
    });
    const r = await sinkronkanIndikatorSoal(db, ambil);
    expect(r.paket[0]).toMatchObject({ galatSumber: "koneksi ke Supabase gagal", tidakBisaDicocokkan: 1, terisiDariSumber: 0 });
    expect(r.paket[1]).toMatchObject({ galatSumber: null, terisiDariSumber: 1, baruTertaut: 1 });
  });

  it("sumber paket yang sama dibaca SEKALI walau diimpor berkali-kali", async () => {
    const ulang: Impor = { ...paketSmpMat, package: { ...paketSmpMat.package, id: "p1b", nama: "Paket A1 (impor ulang)" } };
    const { db } = buatDb({
      impor: [paketSmpMat, ulang],
      soalPerPaket: {
        p1: [{ id: "a", teks: "Soal satu", indikatorId: null, indikatorTeks: null }],
        p1b: [{ id: "b", teks: "Soal satu", indikatorId: null, indikatorTeks: null }],
      },
    });
    const ambil = vi.fn(async () => sumber);
    const r = await sinkronkanIndikatorSoal(db, ambil);
    expect(ambil).toHaveBeenCalledTimes(1);
    expect(r.total).toMatchObject({ soal: 2, baruTertaut: 2, terisiDariSumber: 2 });
  });

  it("diulang dua kali: proses kedua tidak mengubah apa pun (idempoten)", async () => {
    const soal: Soal[] = [{ id: "q1", teks: "Soal satu", indikatorId: null, indikatorTeks: null }];
    const { db, updateMany } = buatDb({ impor: [paketSmpMat], soalPerPaket: { p1: soal } });
    await sinkronkanIndikatorSoal(db, async () => sumber);
    expect(updateMany).toHaveBeenCalledTimes(1);
    // keadaan setelah proses pertama
    soal[0] = { id: "q1", teks: "Soal satu", indikatorId: "m-smp-mat-1", indikatorTeks: "Menyelesaikan operasi bilangan bentuk pangkat (1)" };
    updateMany.mockClear();
    const r2 = await sinkronkanIndikatorSoal(db, async () => sumber);
    expect(updateMany).not.toHaveBeenCalled();
    expect(r2.total).toMatchObject({ baruTertaut: 0, terisiDariSumber: 0, tertaut: 1 });
  });

  it("puluhan soal dengan indikator sama dikelompokkan jadi SATU pembaruan, semua dalam satu transaksi", async () => {
    const soal: Soal[] = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, teks: "Soal satu", indikatorId: null, indikatorTeks: null }));
    const { db, updateMany, transaksi } = buatDb({ impor: [paketSmpMat], soalPerPaket: { p1: soal } });
    await sinkronkanIndikatorSoal(db, async () => sumber);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect((updateMany.mock.calls[0]![0] as { where: { id: { in: string[] } } }).where.id.in).toHaveLength(30);
    expect(transaksi).toHaveBeenCalledTimes(1);
  });

  it("tidak ada paket impor sama sekali: laporan kosong tanpa galat", async () => {
    const { db } = buatDb({ impor: [], soalPerPaket: {} });
    const r = await sinkronkanIndikatorSoal(db, async () => sumber);
    expect(r).toEqual({ masterKosong: false, paket: [], total: { soal: 0, tertaut: 0, baruTertaut: 0, terisiDariSumber: 0, diLuarResmi: 0 } });
  });
});
