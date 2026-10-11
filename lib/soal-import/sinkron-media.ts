import "server-only";
import type { PrismaClient } from "@prisma/client";
import { formatQuestionMedia, parseQuestionMedia } from "@/lib/soal/media-types";
import { validasiSvgSumber, type SourceGambar } from "./media";

export type AmbilGambarSumber = (sourcePaketId: string) => Promise<Array<{ teks: string; gambar: SourceGambar | null | undefined }>>;

export type AlasanLewati =
  /** Media soal sekarang sudah berisi dua gambar atau lebih: tidak diubah (membuat proses ini aman diulang). */
  | "sudah_ganda"
  /** Soal sumbernya memang hanya punya satu gambar (tidak ada diagram cadangan): tidak ada yang ditambahkan. */
  | "sumber_satu_gambar"
  /** SVG di sumber rusak (aturan yang sama dengan saat impor): tidak disalin supaya siswa tidak melihat gambar rusak. */
  | "diagram_tidak_valid"
  /** Media soal sekarang bukan sebuah foto yang tersimpan (kosong, hanya diagram, atau tidak terbaca): tidak ada foto untuk dipasangkan. */
  | "tanpa_foto_tersimpan";

export type RencanaMedia = { aksi: "perbarui"; mediaBaru: string } | { aksi: "lewati"; alasan: AlasanLewati };

/**
 * Soal ber-"ilustrasi kontekstual" di soal.ayotka.id punya DUA gambar: foto (url/image_data) dan Diagram Presisi
 * (svg_fallback). Sebelum fitur media ganda, impor hanya menyimpan fotonya (sebagai satu alamat gambar di Question.media),
 * sehingga siswa tidak pernah melihat diagramnya padahal pratinjau admin menampilkan keduanya.
 *
 * Fungsi murni ini memutuskan apakah media sebuah soal yang sudah diimpor boleh ditingkatkan menjadi dua gambar:
 *  - hanya bila media sekarang SATU foto yang sudah tersimpan (alamatnya dipakai apa adanya; tidak ada yang diunduh), dan
 *    sumbernya punya diagram yang lolos validasi SVG yang sama dengan saat impor;
 *  - media yang sudah berisi dua gambar atau lebih tidak pernah diubah;
 *  - keterangan visualisasi (deskripsi_alt) ikut disimpan, sama seperti impor baru.
 * Diagram disimpan sebagai markup SVG saja (tanpa salinan data URI) supaya baris soal tidak membengkak dua kali lipat.
 */
export function rencanaMediaGanda(gambar: SourceGambar | null | undefined, mediaSekarang: string | null): RencanaMedia {
  const sekarang = parseQuestionMedia(mediaSekarang);
  if (sekarang && sekarang.items.length >= 2) return { aksi: "lewati", alasan: "sudah_ganda" };

  const diagram = gambar?.tipe === "ilustrasi_kontekstual" ? (gambar.svg_fallback ?? "").trim() : "";
  if (!gambar || !diagram) return { aksi: "lewati", alasan: "sumber_satu_gambar" };
  if (validasiSvgSumber(diagram)) return { aksi: "lewati", alasan: "diagram_tidak_valid" };

  const itemSekarang = sekarang?.items.length === 1 ? sekarang.items[0]! : null;
  const foto = itemSekarang?.tipe === "foto" ? itemSekarang.url : undefined;
  if (!foto) return { aksi: "lewati", alasan: "tanpa_foto_tersimpan" };

  return {
    aksi: "perbarui",
    mediaBaru: formatQuestionMedia({
      tipe: "multi",
      caption: gambar.deskripsi_alt?.trim() || null,
      items: [
        { tipe: "svg", label: "Diagram Presisi (SVG)", svgContent: diagram },
        { tipe: "foto", label: "Foto Ilustrasi", url: foto },
      ],
    }),
  };
}

export interface LaporanSinkronMediaPaket {
  packageId: string;
  nama: string;
  kodeSumber: string;
  soal: number;
  /** Soal yang media-nya diperbarui (pada simulasi: yang AKAN diperbarui). */
  diperbarui: number;
  sudahGanda: number;
  sumberSatuGambar: number;
  diagramTidakValid: number;
  tanpaFotoTersimpan: number;
  /** Teks soal tidak ditemukan di sumber (mis. sudah diedit), atau muncul lebih dari sekali dengan gambar berbeda: dibiarkan. */
  tidakBisaDicocokkan: number;
  /** Media soal berubah oleh pihak lain selagi proses berjalan: dilewati, aman diulang. */
  berubahSaatProses: number;
  /** Pesan bila soal sumber paket ini tidak bisa dibaca (paket lain tetap diproses). */
  galatSumber: string | null;
  /** Cuplikan teks beberapa soal yang diperbarui, untuk diperiksa admin. */
  contoh: string[];
}

export interface TotalSinkronMedia {
  paket: number;
  soal: number;
  diperbarui: number;
  sudahGanda: number;
  sumberSatuGambar: number;
  /** Diagram rusak + tanpa foto tersimpan + teks tidak cocok + berubah saat proses + paket sumber tak terbaca. */
  perluDicek: number;
}

export interface LaporanSinkronMedia {
  /** false = simulasi: tidak ada yang ditulis. */
  jalankan: boolean;
  paket: LaporanSinkronMediaPaket[];
  total: TotalSinkronMedia;
}

type SumberPerTeks = Map<string, { tanda: string; gambar: SourceGambar | null | undefined } | "ambigu">;

/** Satu entri per teks soal; teks yang muncul lebih dari sekali dengan gambar BERBEDA ditandai ambigu (lebih baik dilewati daripada salah gambar). */
function petakanSumber(sumber: Array<{ teks: string; gambar: SourceGambar | null | undefined }>): SumberPerTeks {
  const peta: SumberPerTeks = new Map();
  for (const s of sumber) {
    const tanda = JSON.stringify(s.gambar ?? null);
    const ada = peta.get(s.teks);
    if (!ada) peta.set(s.teks, { tanda, gambar: s.gambar });
    else if (ada !== "ambigu" && ada.tanda !== tanda) peta.set(s.teks, "ambigu");
  }
  return peta;
}

const jumlahGambar = (media: string | null) => parseQuestionMedia(media)?.items.length ?? 0;

/** Soal yang masih berupa SATU foto: hanya itu yang mungkin ditingkatkan, jadi hanya paket yang punya soal begini yang perlu membaca sumber. */
function kandidat(media: string | null): boolean {
  const m = parseQuestionMedia(media);
  return m !== null && m.items.length === 1 && m.items[0]!.tipe === "foto";
}

const potong = (teks: string) => (teks.length > 80 ? `${teks.slice(0, 77)}...` : teks);

/**
 * Tingkatkan soal yang SUDAH diimpor dari soal.ayotka.id menjadi dua gambar (Diagram Presisi + Foto Ilustrasi) bila
 * sumbernya memilikinya. Pencocokan per paket lewat TEKS SOAL yang persis sama (ambigu atau tidak ketemu = dibiarkan).
 * `jalankan: false` hanya menghitung (simulasi). Setiap pembaruan bersyarat pada nilai media yang tadi dibaca, jadi tidak
 * menimpa perubahan lain; aman diulang (soal yang sudah dua gambar dilewati).
 */
export async function sinkronkanMediaSoal(
  db: PrismaClient,
  ambilSumber: AmbilGambarSumber,
  opsi: { jalankan: boolean },
): Promise<LaporanSinkronMedia> {
  const impor = await db.soalImportLog.findMany({
    orderBy: { importedAt: "asc" },
    select: { sourcePaketId: true, sourcePaketCode: true, package: { select: { id: true, nama: true } } },
  });

  const cacheSumber = new Map<string, SumberPerTeks>();
  const paket: LaporanSinkronMediaPaket[] = [];

  for (const log of impor) {
    const pkg = log.package;
    const soal = await db.question.findMany({ where: { packageId: pkg.id }, select: { id: true, teks: true, media: true } });

    const laporan: LaporanSinkronMediaPaket = {
      packageId: pkg.id,
      nama: pkg.nama,
      kodeSumber: log.sourcePaketCode,
      soal: soal.length,
      diperbarui: 0,
      sudahGanda: 0,
      sumberSatuGambar: 0,
      diagramTidakValid: 0,
      tanpaFotoTersimpan: 0,
      tidakBisaDicocokkan: 0,
      berubahSaatProses: 0,
      galatSumber: null,
      contoh: [],
    };

    laporan.sudahGanda = soal.filter((q) => jumlahGambar(q.media) >= 2).length;
    const perluSumber = soal.filter((q) => kandidat(q.media));

    const perubahan: Array<{ id: string; lama: string; baru: string; teks: string }> = [];
    if (perluSumber.length > 0) {
      let sumber = cacheSumber.get(log.sourcePaketId);
      if (!sumber) {
        try {
          sumber = petakanSumber(await ambilSumber(log.sourcePaketId));
          cacheSumber.set(log.sourcePaketId, sumber);
        } catch (err) {
          laporan.galatSumber = err instanceof Error ? err.message : String(err);
        }
      }

      if (sumber) {
        for (const q of perluSumber) {
          const asal = sumber.get(q.teks);
          if (!asal || asal === "ambigu") {
            laporan.tidakBisaDicocokkan++;
            continue;
          }
          const rencana = rencanaMediaGanda(asal.gambar, q.media);
          if (rencana.aksi === "perbarui") {
            perubahan.push({ id: q.id, lama: q.media!, baru: rencana.mediaBaru, teks: q.teks });
            continue;
          }
          // "sudah_ganda" tidak mungkin terjadi di sini (kandidat selalu satu foto; yang sudah ganda dihitung di atas).
          if (rencana.alasan === "sumber_satu_gambar") laporan.sumberSatuGambar++;
          else if (rencana.alasan === "diagram_tidak_valid") laporan.diagramTidakValid++;
          else laporan.tanpaFotoTersimpan++;
        }
      }
    }

    laporan.diperbarui = perubahan.length;
    laporan.contoh = perubahan.slice(0, 3).map((p) => potong(p.teks));

    if (opsi.jalankan && perubahan.length > 0) {
      const hasil = await db.$transaction(
        perubahan.map((p) => db.question.updateMany({ where: { id: p.id, media: p.lama }, data: { media: p.baru } })),
      );
      const berhasil = hasil.reduce((jumlah, r) => jumlah + r.count, 0);
      laporan.diperbarui = berhasil;
      laporan.berubahSaatProses = perubahan.length - berhasil;
    }

    paket.push(laporan);
  }

  const jumlah = (f: (p: LaporanSinkronMediaPaket) => number) => paket.reduce((a, p) => a + f(p), 0);
  return {
    jalankan: opsi.jalankan,
    paket,
    total: {
      paket: paket.length,
      soal: jumlah((p) => p.soal),
      diperbarui: jumlah((p) => p.diperbarui),
      sudahGanda: jumlah((p) => p.sudahGanda),
      sumberSatuGambar: jumlah((p) => p.sumberSatuGambar),
      perluDicek: jumlah(
        (p) => p.diagramTidakValid + p.tanpaFotoTersimpan + p.tidakBisaDicocokkan + p.berubahSaatProses + (p.galatSumber ? 1 : 0),
      ),
    },
  };
}
