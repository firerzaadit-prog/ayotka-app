import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { BarisMaster } from "./master";
import { rencanaSimpanMaster } from "./rencana-master";

export interface HasilSimpanMaster {
  total: number;
  dibuat: number;
  diperbarui: number;
  samaPersis: number;
  tidakAdaDiBerkas: number;
}

/** Simpan master yang SUDAH divalidasi (parseMasterJson): semua perubahan dalam satu transaksi - berhasil seluruhnya atau tidak sama sekali. */
export async function simpanMaster(db: PrismaClient, baris: BarisMaster[]): Promise<HasilSimpanMaster> {
  const ada = await db.indikatorResmi.findMany({
    select: {
      id: true,
      jenjang: true,
      namaMapel: true,
      teksKunci: true,
      kdMapel: true,
      elemen: true,
      subelemen: true,
      kompetensi: true,
      subkompetensi: true,
      indikator: true,
      urutan: true,
      nilaiNasional: true,
    },
  });
  const rencana = rencanaSimpanMaster(ada, baris);

  await db.$transaction([
    ...(rencana.buat.length > 0 ? [db.indikatorResmi.createMany({ data: rencana.buat })] : []),
    ...rencana.perbarui.map((p) => db.indikatorResmi.update({ where: { id: p.id }, data: p.data })),
  ]);

  return {
    total: baris.length,
    dibuat: rencana.buat.length,
    diperbarui: rencana.perbarui.length,
    samaPersis: rencana.samaPersis,
    tidakAdaDiBerkas: rencana.tidakAdaDiBerkas,
  };
}

export interface RingkasanMasterMapel {
  jenjang: string;
  namaMapel: string;
  jumlah: number;
  /** Berapa indikator yang punya rerata nasional. */
  adaNilaiNasional: number;
  rerataNasional: number | null;
}

export interface RingkasanMaster {
  mapel: RingkasanMasterMapel[];
  totalIndikator: number;
  diperbaruiTerakhir: Date | null;
  /** Soal yang tertaut ke indikator resmi / punya indikator tetapi bukan resmi / tanpa indikator (semua paket). */
  soal: { tertaut: number; diLuarResmi: number; tanpaIndikator: number };
}

export async function ringkasMaster(db: PrismaClient): Promise<RingkasanMaster> {
  const [baris, tertaut, diLuarResmi, tanpaIndikator] = await Promise.all([
    db.indikatorResmi.findMany({ select: { jenjang: true, namaMapel: true, nilaiNasional: true, updatedAt: true } }),
    db.question.count({ where: { indikatorId: { not: null } } }),
    db.question.count({ where: { indikatorId: null, indikatorTeks: { not: null } } }),
    db.question.count({ where: { indikatorId: null, indikatorTeks: null } }),
  ]);

  const peta = new Map<string, RingkasanMasterMapel & { jumlahNilai: number }>();
  let diperbaruiTerakhir: Date | null = null;
  for (const b of baris) {
    const kunci = `${b.jenjang}|${b.namaMapel}`;
    const e = peta.get(kunci) ?? { jenjang: b.jenjang, namaMapel: b.namaMapel, jumlah: 0, adaNilaiNasional: 0, rerataNasional: null, jumlahNilai: 0 };
    e.jumlah++;
    if (b.nilaiNasional != null) {
      e.adaNilaiNasional++;
      e.jumlahNilai += b.nilaiNasional;
    }
    peta.set(kunci, e);
    if (!diperbaruiTerakhir || b.updatedAt > diperbaruiTerakhir) diperbaruiTerakhir = b.updatedAt;
  }

  const mapel = [...peta.values()]
    .map(({ jumlahNilai, ...e }) => ({ ...e, rerataNasional: e.adaNilaiNasional > 0 ? jumlahNilai / e.adaNilaiNasional : null }))
    .sort((a, b) => a.jenjang.localeCompare(b.jenjang) || a.namaMapel.localeCompare(b.namaMapel));

  return {
    mapel,
    totalIndikator: baris.length,
    diperbaruiTerakhir,
    soal: { tertaut, diLuarResmi, tanpaIndikator },
  };
}
