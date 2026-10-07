import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { parseMasterJson, type BarisMaster } from "@/lib/indikator/master";
import { rencanaSimpanMaster, type MasterTersimpan } from "@/lib/indikator/rencana-master";

vi.mock("server-only", () => ({}));

import { ringkasMaster, simpanMaster } from "@/lib/indikator/master-simpan";

const baru = (o: Partial<BarisMaster> = {}): BarisMaster => ({
  jenjang: "SMP",
  kdMapel: "MATP",
  namaMapel: "Matematika",
  elemen: "Bilangan",
  subelemen: "Bilangan Real",
  kompetensi: "Kemampuan X",
  subkompetensi: null,
  indikator: "Menyelesaikan operasi bilangan bentuk pangkat (1)",
  teksKunci: "menyelesaikan operasi bilangan bentuk pangkat (1)",
  urutan: 1,
  nilaiNasional: 34.09,
  ...o,
});
const ada = (id: string, o: Partial<MasterTersimpan> = {}): MasterTersimpan => {
  const { jenjang, namaMapel, teksKunci, kdMapel, elemen, subelemen, kompetensi, subkompetensi, indikator, urutan, nilaiNasional } = baru();
  return { id, jenjang, namaMapel, teksKunci, kdMapel, elemen, subelemen, kompetensi, subkompetensi, indikator, urutan, nilaiNasional, ...o };
};

describe("rencanaSimpanMaster", () => {
  it("database kosong: semua indikator baru ditambahkan", () => {
    const r = rencanaSimpanMaster([], [baru(), baru({ indikator: "Lain (2)", teksKunci: "lain (2)", urutan: 2 })]);
    expect(r.buat).toHaveLength(2);
    expect(r).toMatchObject({ perbarui: [], samaPersis: 0, tidakAdaDiBerkas: 0 });
  });

  it("unggah ulang berkas yang sama: tidak ada yang berubah (aman diulang)", () => {
    const r = rencanaSimpanMaster([ada("a")], [baru()]);
    expect(r).toMatchObject({ buat: [], perbarui: [], samaPersis: 1, tidakAdaDiBerkas: 0 });
  });

  it("nilai nasional baru memperbarui baris yang sama (dikenali lewat jenjang+mapel+teks), tanpa membuat baris ganda", () => {
    const r = rencanaSimpanMaster([ada("a")], [baru({ nilaiNasional: 40.5 })]);
    expect(r.buat).toHaveLength(0);
    expect(r.perbarui).toEqual([{ id: "a", data: expect.objectContaining({ nilaiNasional: 40.5 }) }]);
    expect(r.samaPersis).toBe(0);
  });

  it("nilai nasional yang dulu ada lalu kosong di berkas baru ikut diperbarui menjadi null", () => {
    const r = rencanaSimpanMaster([ada("a")], [baru({ nilaiNasional: null })]);
    expect(r.perbarui[0]!.data.nilaiNasional).toBeNull();
  });

  it("perubahan hierarki (elemen/subelemen/kompetensi/urutan) diperbarui", () => {
    for (const ubah of [{ elemen: "Aljabar" }, { subelemen: "Lain" }, { kompetensi: "Kemampuan Y" }, { urutan: 9 }, { subkompetensi: "Sub" }, { kdMapel: "MATX" }]) {
      const r = rencanaSimpanMaster([ada("a")], [baru(ubah)]);
      expect(r.perbarui, JSON.stringify(ubah)).toHaveLength(1);
    }
  });

  it("indikator di database yang tidak ada di berkas baru TIDAK dihapus; hanya dihitung", () => {
    const r = rencanaSimpanMaster([ada("a"), ada("b", { indikator: "Lama (3)", teksKunci: "lama (3)" })], [baru()]);
    expect(r.tidakAdaDiBerkas).toBe(1);
    expect(r.buat).toHaveLength(0);
    expect(r.perbarui).toHaveLength(0);
  });

  it("jenjang berbeda dengan teks sama adalah indikator berbeda", () => {
    const r = rencanaSimpanMaster([ada("a")], [baru({ jenjang: "SD" })]);
    expect(r.buat).toHaveLength(1);
    expect(r.tidakAdaDiBerkas).toBe(1);
  });

  it("nama mapel dibandingkan tanpa peduli huruf besar: tidak membuat baris ganda, tetapi nama diperbarui", () => {
    const r = rencanaSimpanMaster([ada("a", { namaMapel: "matematika" })], [baru({ namaMapel: "Matematika" })]);
    expect(r.buat).toHaveLength(0);
    expect(r.perbarui).toEqual([{ id: "a", data: expect.objectContaining({ namaMapel: "Matematika" }) }]);
  });

  it("campuran: sebagian baru, sebagian berubah, sebagian sama, sebagian hilang", () => {
    const db = [ada("a"), ada("b", { indikator: "B (2)", teksKunci: "b (2)", nilaiNasional: 10 }), ada("c", { indikator: "C (3)", teksKunci: "c (3)" })];
    const berkas = [baru(), baru({ indikator: "B (2)", teksKunci: "b (2)", nilaiNasional: 11 }), baru({ indikator: "D (4)", teksKunci: "d (4)" })];
    const r = rencanaSimpanMaster(db, berkas);
    expect({ buat: r.buat.length, perbarui: r.perbarui.length, sama: r.samaPersis, hilang: r.tidakAdaDiBerkas }).toEqual({ buat: 1, perbarui: 1, sama: 1, hilang: 1 });
  });

  it("bekerja dengan hasil parseMasterJson yang sebenarnya (berkas master bentuk asli)", () => {
    const hasil = parseMasterJson([
      { jenjang: "SMP", kd_mapel: "MATP", nama_mapel: "Matematika", elemen: "Bilangan", subelemen: "Bilangan Real", kompetensi: "K", subkompetensi: "-", indikator: "Ind A (1)", urutan: 1, nilai_nasional: 34.09 },
      { jenjang: "SMP", kd_mapel: "BINP", nama_mapel: "Bahasa Indonesia", elemen: "Pemahaman Tekstual", subelemen: "S", kompetensi: "S", indikator: "Ind B (1)", urutan: 1, nilai_nasional: 60.05 },
    ]);
    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    const pertama = rencanaSimpanMaster([], hasil.baris);
    expect(pertama.buat).toHaveLength(2);
    // simpan lalu unggah ulang: harus "sama persis" semuanya
    const tersimpan = pertama.buat.map((b, i) => ({ id: `id${i}`, ...b }));
    const kedua = rencanaSimpanMaster(tersimpan, hasil.baris);
    expect(kedua).toMatchObject({ buat: [], perbarui: [], samaPersis: 2, tidakAdaDiBerkas: 0 });
  });
});

type DbTiruan = {
  indikatorResmi: { findMany: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  question: { count: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
function buatDb(tersimpan: MasterTersimpan[]) {
  const urutan: string[] = [];
  const db: DbTiruan = {
    indikatorResmi: {
      findMany: vi.fn(async () => tersimpan),
      createMany: vi.fn((arg) => ({ jenis: "createMany", arg })),
      update: vi.fn((arg) => ({ jenis: "update", arg })),
    },
    question: { count: vi.fn(async () => 0) },
    $transaction: vi.fn(async (ops: unknown[]) => {
      urutan.push(`transaksi(${ops.length})`);
      return ops;
    }),
  };
  return { db: db as unknown as PrismaClient, mentah: db, urutan };
}

describe("simpanMaster", () => {
  it("semua perubahan dalam SATU transaksi: tambah + perbarui", async () => {
    const { db, mentah, urutan } = buatDb([ada("a", { nilaiNasional: 1 })]);
    const hasil = await simpanMaster(db, [baru({ nilaiNasional: 2 }), baru({ indikator: "Baru (2)", teksKunci: "baru (2)" })]);
    expect(hasil).toEqual({ total: 2, dibuat: 1, diperbarui: 1, samaPersis: 0, tidakAdaDiBerkas: 0 });
    expect(urutan).toEqual(["transaksi(2)"]);
    expect(mentah.indikatorResmi.createMany).toHaveBeenCalledTimes(1);
    expect(mentah.indikatorResmi.update).toHaveBeenCalledWith({ where: { id: "a" }, data: expect.objectContaining({ nilaiNasional: 2 }) });
  });

  it("tidak ada yang berubah: tidak memanggil createMany/update (transaksi kosong)", async () => {
    const { db, mentah } = buatDb([ada("a")]);
    const hasil = await simpanMaster(db, [baru()]);
    expect(hasil).toMatchObject({ dibuat: 0, diperbarui: 0, samaPersis: 1 });
    expect(mentah.indikatorResmi.createMany).not.toHaveBeenCalled();
    expect(mentah.indikatorResmi.update).not.toHaveBeenCalled();
  });

  it("tidak pernah menghapus apa pun", async () => {
    const { db, mentah } = buatDb([ada("a"), ada("b", { indikator: "Lama (3)", teksKunci: "lama (3)" })]);
    const hasil = await simpanMaster(db, [baru()]);
    expect(hasil.tidakAdaDiBerkas).toBe(1);
    expect(Object.keys(mentah.indikatorResmi)).not.toContain("delete");
    expect(Object.keys(mentah.indikatorResmi)).not.toContain("deleteMany");
  });

  it("galat database diteruskan (route yang menjawab 500), bukan ditelan", async () => {
    const { db, mentah } = buatDb([]);
    mentah.$transaction.mockRejectedValueOnce(new Error("koneksi putus"));
    await expect(simpanMaster(db, [baru()])).rejects.toThrow("koneksi putus");
  });
});

describe("ringkasMaster", () => {
  it("merangkum per jenjang + mapel: jumlah, yang punya nilai nasional, rerata; plus cakupan soal", async () => {
    const waktu1 = new Date("2026-10-05T00:00:00Z");
    const waktu2 = new Date("2026-10-07T00:00:00Z");
    const db = {
      indikatorResmi: {
        findMany: vi.fn(async () => [
          { jenjang: "SMP", namaMapel: "Matematika", nilaiNasional: 30, updatedAt: waktu1 },
          { jenjang: "SMP", namaMapel: "Matematika", nilaiNasional: 50, updatedAt: waktu2 },
          { jenjang: "SMP", namaMapel: "Matematika", nilaiNasional: null, updatedAt: waktu1 },
          { jenjang: "SD", namaMapel: "Bahasa Indonesia", nilaiNasional: 60, updatedAt: waktu1 },
        ]),
      },
      question: {
        count: vi.fn(async ({ where }: { where: { indikatorId: unknown; indikatorTeks?: unknown } }) => {
          if (where.indikatorId && typeof where.indikatorId === "object") return 7; // tertaut
          return where.indikatorTeks ? 3 : 11; // di luar resmi : tanpa indikator
        }),
      },
    } as unknown as PrismaClient;
    const r = await ringkasMaster(db);
    expect(r.totalIndikator).toBe(4);
    expect(r.diperbaruiTerakhir).toEqual(waktu2);
    expect(r.soal).toEqual({ tertaut: 7, diLuarResmi: 3, tanpaIndikator: 11 });
    expect(r.mapel).toEqual([
      { jenjang: "SD", namaMapel: "Bahasa Indonesia", jumlah: 1, adaNilaiNasional: 1, rerataNasional: 60 },
      { jenjang: "SMP", namaMapel: "Matematika", jumlah: 3, adaNilaiNasional: 2, rerataNasional: 40 },
    ]);
  });

  it("master kosong: ringkasan kosong tanpa galat", async () => {
    const db = { indikatorResmi: { findMany: vi.fn(async () => []) }, question: { count: vi.fn(async () => 0) } } as unknown as PrismaClient;
    const r = await ringkasMaster(db);
    expect(r).toMatchObject({ mapel: [], totalIndikator: 0, diperbaruiTerakhir: null });
  });
});
