import "server-only";
import type { PrismaClient } from "@prisma/client";
import { buatPencocokIndikator, cocokkanSoalDenganSumber } from "./pencocokan";

export type AmbilSumberPaket = (sourcePaketId: string) => Promise<Array<{ teks: string; indikator: string | null }>>;

export interface LaporanSinkronPaket {
  packageId: string;
  nama: string;
  kodeSumber: string;
  soal: number;
  /** Sudah tertaut ke indikator resmi sebelum proses ini. */
  sudahTertaut: number;
  /** Teks indikator yang baru diisi dari soal sumbernya pada proses ini. */
  terisiDariSumber: number;
  /** Tautan ke indikator resmi yang baru terbentuk pada proses ini. */
  baruTertaut: number;
  /** Punya teks indikator, tetapi bukan indikator resmi (tidak ikut hitungan daya serap per indikator). */
  diLuarResmi: number;
  /** Soal yang teksnya tidak ditemukan lagi di sumber (mis. sudah diedit) atau ambigu di sumber: dibiarkan kosong. */
  tidakBisaDicocokkan: number;
  /** Soal yang di sumbernya memang tidak punya indikator. */
  sumberTanpaIndikator: number;
  /** Pesan bila soal sumber paket ini tidak bisa dibaca (paket lain tetap diproses). */
  galatSumber: string | null;
}

export interface LaporanSinkron {
  /** true = master belum diunggah, tidak ada yang diproses. */
  masterKosong: boolean;
  paket: LaporanSinkronPaket[];
  total: { soal: number; tertaut: number; baruTertaut: number; terisiDariSumber: number; diLuarResmi: number };
}

type Perubahan = { id: string; teks: string | null; indikatorId: string | null };

/**
 * Isi indikator pada soal yang SUDAH diimpor sebelum fitur indikator ada, dan tautkan ke master resmi:
 *  1. soal yang belum punya teks indikator dicocokkan dengan soal sumbernya lewat TEKS SOAL yang persis sama (ambigu
 *     atau tidak ketemu = dibiarkan kosong, lebih baik kosong daripada salah soal);
 *  2. soal yang punya teks indikator tetapi belum tertaut dicocokkan ke master lewat teks indikator yang persis sama
 *     (dipakai juga bila master baru diunggah SESUDAH impor).
 * Aman diulang: yang sudah terisi tidak pernah ditimpa (setiap pembaruan bersyarat pada kolom yang masih kosong).
 */
export async function sinkronkanIndikatorSoal(db: PrismaClient, ambilSumber: AmbilSumberPaket): Promise<LaporanSinkron> {
  const master = await db.indikatorResmi.findMany({ select: { id: true, jenjang: true, namaMapel: true, teksKunci: true } });
  if (master.length === 0) {
    return { masterKosong: true, paket: [], total: { soal: 0, tertaut: 0, baruTertaut: 0, terisiDariSumber: 0, diLuarResmi: 0 } };
  }
  const cocokkan = buatPencocokIndikator(master);

  const impor = await db.soalImportLog.findMany({
    orderBy: { importedAt: "asc" },
    select: {
      sourcePaketId: true,
      sourcePaketCode: true,
      package: { select: { id: true, nama: true, jenjang: true, subject: { select: { nama: true } } } },
    },
  });

  const cacheSumber = new Map<string, Awaited<ReturnType<AmbilSumberPaket>>>();
  const paket: LaporanSinkronPaket[] = [];

  for (const log of impor) {
    const pkg = log.package;
    const soal = await db.question.findMany({
      where: { packageId: pkg.id },
      select: { id: true, teks: true, indikatorId: true, indikatorTeks: true },
    });

    const laporan: LaporanSinkronPaket = {
      packageId: pkg.id,
      nama: pkg.nama,
      kodeSumber: log.sourcePaketCode,
      soal: soal.length,
      sudahTertaut: soal.filter((q) => q.indikatorId).length,
      terisiDariSumber: 0,
      baruTertaut: 0,
      diLuarResmi: 0,
      tidakBisaDicocokkan: 0,
      sumberTanpaIndikator: 0,
      galatSumber: null,
    };

    // 1. isi teks indikator dari sumber
    const teksBaru = new Map<string, string>();
    const butuhSumber = soal.filter((q) => q.indikatorTeks === null && q.indikatorId === null);
    if (butuhSumber.length > 0) {
      try {
        let sumber = cacheSumber.get(log.sourcePaketId);
        if (!sumber) {
          sumber = await ambilSumber(log.sourcePaketId);
          cacheSumber.set(log.sourcePaketId, sumber);
        }
        const hasil = cocokkanSoalDenganSumber(
          butuhSumber.map((q) => ({ id: q.id, teks: q.teks })),
          sumber,
        );
        for (const [id, teks] of hasil.cocok) teksBaru.set(id, teks);
        laporan.tidakBisaDicocokkan = hasil.ambigu + hasil.tanpaSumber;
        laporan.sumberTanpaIndikator = hasil.sumberTanpaIndikator;
      } catch (err) {
        laporan.galatSumber = err instanceof Error ? err.message : String(err);
        laporan.tidakBisaDicocokkan = butuhSumber.length;
      }
    }

    // 2. tautkan ke master lewat teks indikator (yang lama maupun yang baru diisi)
    const perubahan: Perubahan[] = [];
    for (const q of soal) {
      const teksSetelah = q.indikatorTeks ?? teksBaru.get(q.id) ?? null;
      const idBaru =
        q.indikatorId === null && teksSetelah !== null
          ? cocokkan({ jenjang: pkg.jenjang, mapel: pkg.subject.nama, indikator: teksSetelah })
          : null;
      const isiTeks = q.indikatorTeks === null && teksBaru.has(q.id) ? teksBaru.get(q.id)! : null;
      if (isiTeks !== null) laporan.terisiDariSumber++;
      if (idBaru !== null) laporan.baruTertaut++;
      if (isiTeks !== null || idBaru !== null) perubahan.push({ id: q.id, teks: isiTeks, indikatorId: idBaru });
      if (teksSetelah !== null && q.indikatorId === null && idBaru === null) laporan.diLuarResmi++;
    }

    // Satu pembaruan per kombinasi nilai (puluhan soal berbagi segelintir indikator), semuanya satu transaksi.
    // Setiap pembaruan bersyarat pada kolom yang MASIH kosong supaya tidak menimpa hasil proses lain.
    const kelompok = new Map<string, { teks: string | null; indikatorId: string | null; ids: string[] }>();
    for (const p of perubahan) {
      const kunci = `${p.teks ?? ""}\u0000${p.indikatorId ?? ""}`;
      const g = kelompok.get(kunci) ?? { teks: p.teks, indikatorId: p.indikatorId, ids: [] };
      g.ids.push(p.id);
      kelompok.set(kunci, g);
    }
    if (kelompok.size > 0) {
      await db.$transaction(
        [...kelompok.values()].map((g) =>
          db.question.updateMany({
            where: {
              id: { in: g.ids },
              ...(g.teks !== null ? { indikatorTeks: null } : {}),
              ...(g.indikatorId !== null ? { indikatorId: null } : {}),
            },
            data: {
              ...(g.teks !== null ? { indikatorTeks: g.teks } : {}),
              ...(g.indikatorId !== null ? { indikatorId: g.indikatorId } : {}),
            },
          }),
        ),
      );
    }

    paket.push(laporan);
  }

  return {
    masterKosong: false,
    paket,
    total: {
      soal: paket.reduce((a, p) => a + p.soal, 0),
      tertaut: paket.reduce((a, p) => a + p.sudahTertaut + p.baruTertaut, 0),
      baruTertaut: paket.reduce((a, p) => a + p.baruTertaut, 0),
      terisiDariSumber: paket.reduce((a, p) => a + p.terisiDariSumber, 0),
      diLuarResmi: paket.reduce((a, p) => a + p.diLuarResmi, 0),
    },
  };
}
