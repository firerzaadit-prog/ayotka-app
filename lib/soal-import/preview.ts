import "server-only";
import { prisma } from "@/lib/db/prisma";
import {
  getPackageById,
  getQuestionsForPackage,
  getStimulusByIds,
  type SourcePaket,
  type SourceQuestion,
} from "./source-db";
import { translateBentukSoal, translateLevelKognitif, translateTingkatKesulitan } from "./format-translator";
import { resolveTaxonomyMapping } from "./taxonomy-resolver";
import type { LevelKognitif, QuestionFormat, TingkatKesulitan } from "@prisma/client";

export interface PreviewOption {
  label: string;
  teks: string;
  isCorrect: boolean;
}

export interface PreviewStatement {
  no: number;
  teks: string;
  kategoriBenar: string;
}

export interface PreviewQuestion {
  sourceId: string;
  code: string;
  nomorUrut: number | null;
  format: QuestionFormat | null;
  tingkatKesulitan: TingkatKesulitan | null;
  teks: string;
  pembahasan: string;
  hasGambar: boolean;
  opsi: PreviewOption[];
  kategoriRespons: string[];
  pernyataan: PreviewStatement[];
  elemen: string;
  subElemen: string | null;
  kompetensi: string | null;
  taxonomyMapped: boolean;
  taxonomyKompetensiId: string | null;
  taxonomyKompetensiLabel: string | null;
  levelKognitifSumber: string | null;
  levelBloom: LevelKognitif | null;
  stimulusId: string | null;
  blockedReasons: string[];
}

export interface PreviewStimulus {
  sourceId: string;
  tipe: string;
  judul: string;
  konten: string;
}

export interface PreviousImport {
  packageId: string;
  packageNama: string;
  importedAt: Date;
}

export interface ImportPreview {
  sourcePaket: SourcePaket;
  stimulusList: PreviewStimulus[];
  questions: PreviewQuestion[];
  readyToImport: boolean;
  previousImports: PreviousImport[];
}

function tryTranslate<T>(fn: () => T, blockedReasons: string[], label: string): T | null {
  try {
    return fn();
  } catch (err) {
    blockedReasons.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function buildOptions(q: SourceQuestion, blockedReasons: string[]): PreviewOption[] {
  const opsi = q.payload.opsi ?? [];
  const kunci = q.payload.kunci_jawaban ?? [];
  const labels = new Set(opsi.map((o) => o.label));
  for (const k of kunci) {
    if (!labels.has(k)) {
      blockedReasons.push(`Kunci jawaban "${k}" tidak ada di antara opsi.`);
    }
  }
  return opsi.map((o) => ({ label: o.label, teks: o.text, isCorrect: kunci.includes(o.label) }));
}

function buildStatements(q: SourceQuestion, blockedReasons: string[]): PreviewStatement[] {
  const pernyataan = q.payload.pernyataan ?? [];
  const kunci = q.payload.kunci_jawaban ?? [];
  const kategori = new Set(q.payload.kategori_respons ?? []);
  if (pernyataan.length !== kunci.length) {
    blockedReasons.push(
      `Jumlah pernyataan (${pernyataan.length}) tidak sama dengan jumlah kunci jawaban (${kunci.length}).`,
    );
    return [];
  }
  return pernyataan.map((p, i) => {
    const kategoriBenar = kunci[i]!;
    if (!kategori.has(kategoriBenar)) {
      blockedReasons.push(`Kunci jawaban pernyataan #${p.no} ("${kategoriBenar}") tidak ada di antara kategori respons.`);
    }
    return { no: p.no, teks: p.text, kategoriBenar };
  });
}

/** null berarti paket tidak ditemukan (id/code salah, atau bukan status diterbitkan). */
export async function buildImportPreview(paketIdOrCode: string): Promise<ImportPreview | null> {
  const sourcePaket = await getPackageById(paketIdOrCode);
  if (!sourcePaket) return null;

  const sourceQuestions = await getQuestionsForPackage(sourcePaket.id);
  const stimulusIds = [
    ...new Set(sourceQuestions.map((q) => q.stimulusId).filter((id): id is string => Boolean(id))),
  ];
  const sourceStimulusRows = await getStimulusByIds(stimulusIds);
  const stimulusList: PreviewStimulus[] = sourceStimulusRows.map((s) => ({
    sourceId: s.id,
    tipe: s.tipe,
    judul: s.judul,
    konten: s.konten,
  }));

  // Resolusi taksonomi per soal - findFirst per soal (bukan batch) karena
  // paket standar cuma 30 soal, cukup cepat lewat index yang sudah dibuat.
  const taxonomyResolutions = await Promise.all(
    sourceQuestions.map((q) =>
      resolveTaxonomyMapping(prisma, sourcePaket.mapel, {
        elemen: q.elemen,
        subElemen: q.subElemen,
        kompetensi: q.kompetensi,
      }),
    ),
  );
  const resolvedKompetensiIds = [
    ...new Set(taxonomyResolutions.filter((r): r is NonNullable<typeof r> => r !== null).map((r) => r.kompetensiId)),
  ];
  const kompetensiRows =
    resolvedKompetensiIds.length > 0
      ? await prisma.kompetensi.findMany({
          where: { id: { in: resolvedKompetensiIds } },
          select: { id: true, kode: true, deskripsi: true },
        })
      : [];
  const kompetensiLabelById = new Map(kompetensiRows.map((k) => [k.id, `${k.kode} · ${k.deskripsi}`]));

  const questions: PreviewQuestion[] = sourceQuestions.map((q, i) => {
    const blockedReasons: string[] = [];

    const format = tryTranslate(() => translateBentukSoal(q.bentukSoal), blockedReasons, "Bentuk soal");
    const tingkatKesulitan = q.tingkatKesulitan
      ? tryTranslate(() => translateTingkatKesulitan(q.tingkatKesulitan!), blockedReasons, "Tingkat kesulitan")
      : (blockedReasons.push("Tingkat kesulitan kosong di sumber."), null);
    const levelBloom = translateLevelKognitif(q.levelKognitif);
    if (!levelBloom) {
      // Sengaja TIDAK masuk blockedReasons: ini butuh pilihan manual admin
      // (bukan hal yang pernah "terblokir" secara permanen seperti taksonomi),
      // lihat levelBloom di return di bawah - null berarti perlu override.
    }

    const hasGambar = Boolean(q.payload.gambar);
    if (hasGambar) {
      blockedReasons.push("Soal ini punya gambar - penanganan media belum dibangun (Fase 4), belum bisa diimpor.");
    }

    const opsi = format === "pg" || format === "pg_kompleks" ? buildOptions(q, blockedReasons) : [];
    const pernyataan = format === "pg_kategori" ? buildStatements(q, blockedReasons) : [];

    const taxonomy = taxonomyResolutions[i];

    return {
      sourceId: q.id,
      code: q.code,
      nomorUrut: q.nomorUrut,
      format,
      tingkatKesulitan,
      teks: q.payload.soal_text,
      pembahasan: q.payload.pembahasan,
      hasGambar,
      opsi,
      kategoriRespons: q.payload.kategori_respons ?? [],
      pernyataan,
      elemen: q.elemen,
      subElemen: q.subElemen,
      kompetensi: q.kompetensi,
      taxonomyMapped: taxonomy !== null,
      taxonomyKompetensiId: taxonomy?.kompetensiId ?? null,
      taxonomyKompetensiLabel: taxonomy ? (kompetensiLabelById.get(taxonomy.kompetensiId) ?? null) : null,
      levelKognitifSumber: q.levelKognitif,
      levelBloom,
      stimulusId: q.stimulusId,
      blockedReasons: taxonomy === null ? [...blockedReasons, "Label taksonomi belum pernah dipetakan ke Kompetensi ayotka-app."] : blockedReasons,
    };
  });

  const previousImportRows = await prisma.soalImportLog.findMany({
    where: { sourcePaketId: sourcePaket.id },
    include: { package: { select: { nama: true } } },
    orderBy: { importedAt: "desc" },
  });
  const previousImports: PreviousImport[] = previousImportRows.map((r) => ({
    packageId: r.packageId,
    packageNama: r.package.nama,
    importedAt: r.importedAt,
  }));

  return {
    sourcePaket,
    stimulusList,
    questions,
    readyToImport:
      questions.length > 0 && questions.every((q) => q.blockedReasons.length === 0 && q.levelBloom !== null),
    previousImports,
  };
}
