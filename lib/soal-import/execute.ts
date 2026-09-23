import "server-only";
import { randomUUID, createHash } from "node:crypto";
import type { LevelKognitif, Package, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { buildImportPreview } from "./preview";
import { translateJenjang, translateStimulusTipe } from "./format-translator";
import { getQuestionsForPackage } from "./source-db";
import { resolveSourceImage } from "./media";
import { importImagePath, publicImageUrl, uploadImportImages } from "@/lib/supabase/storage";

export interface ExecuteImportParams {
  sourcePaketId: string;
  subjectId: string;
  tingkatList: number[];
  durasiMenit: number;
  kategori: "mandiri" | "nasional";
  /** Override manual untuk soal yang level_kognitif sumbernya tidak bisa diterjemahkan otomatis. */
  levelBloomOverrides: Record<string, LevelKognitif>;
  importedBy: string;
}

export interface ExecuteImportResult {
  package: Package;
  jumlahSoal: number;
}

export class ImportBlockedError extends Error {
  constructor(public readonly blocked: Array<{ sourceId: string; code: string; reasons: string[] }>) {
    super("Impor diblokir - masih ada soal yang belum siap.");
    this.name = "ImportBlockedError";
  }
}

/**
 * Membuat Package (draft) + Stimulus + Question sekaligus dalam satu
 * transaksi, dan mencatat SoalImportLog (dokumen Bagian 08 langkah 5).
 * Selalu membangun ulang preview dari sumber sebelum eksekusi - tidak
 * pernah percaya data soal dari client, cuma pilihan admin (subject,
 * tingkat, kategori, override level kognitif) yang dipakai dari input.
 */
export async function executeImport(params: ExecuteImportParams): Promise<ExecuteImportResult> {
  const preview = await buildImportPreview(params.sourcePaketId);
  if (!preview) {
    throw new Error("Paket sumber tidak ditemukan.");
  }

  const blocked: Array<{ sourceId: string; code: string; reasons: string[] }> = [];
  const effectiveLevelBloom = new Map<string, LevelKognitif>();
  for (const q of preview.questions) {
    const level = q.levelBloom ?? params.levelBloomOverrides[q.sourceId] ?? null;
    const reasons = [...q.blockedReasons];
    if (!level) reasons.push("Level kognitif belum ditentukan (pilih manual).");
    if (reasons.length > 0) {
      blocked.push({ sourceId: q.sourceId, code: q.code, reasons });
    } else if (level) {
      effectiveLevelBloom.set(q.sourceId, level);
    }
  }
  if (blocked.length > 0) {
    throw new ImportBlockedError(blocked);
  }

  const subject = await prisma.subject.findUnique({ where: { id: params.subjectId } });
  if (!subject) {
    throw new Error("Subject tujuan tidak ditemukan.");
  }
  const jenjang = translateJenjang(preview.sourcePaket.jenjang);
  if (subject.nama !== preview.sourcePaket.mapel || subject.jenjang !== jenjang) {
    throw new Error(
      `Subject "${subject.nama}" (${subject.jenjang}) tidak cocok dengan paket sumber - mapel "${preview.sourcePaket.mapel}", jenjang ${jenjang}.`,
    );
  }

  // Fase 4: gambar diunduh/di-encode di sini (bukan saat preview) - persis sekali, tepat sebelum
  // commit, dan HANYA untuk soal yang sudah lolos semua pemeriksaan lain di atas. Fetch ulang
  // langsung ke soal.ayotka.id (bukan percaya payload dari client) sesuai prinsip yang sama
  // dengan buildImportPreview: tidak pernah percaya data soal dari luar fungsi ini.
  const sourceQuestions = await getQuestionsForPackage(preview.sourcePaket.id);
  const gambarBySourceId = new Map(sourceQuestions.map((q) => [q.id, q.payload.gambar ?? null]));

  type GambarTerunggah = { path: string; url: string; bytes: Buffer; mime: string };
  const gambarUntukSoal = new Map<string, GambarTerunggah | null>();
  const gambarUnik = new Map<string, GambarTerunggah>(); // dedupe by content hash - gambar sama dipakai berkali-kali cukup sekali diunggah

  const KONKURENSI_UNDUH = 4;
  let idxUnduh = 0;
  await Promise.all(
    Array.from({ length: Math.min(KONKURENSI_UNDUH, preview.questions.length) }, async () => {
      while (idxUnduh < preview.questions.length) {
        const q = preview.questions[idxUnduh++]!;
        if (blocked.some((b) => b.sourceId === q.sourceId)) continue; // sudah diblokir alasan lain, jangan tambah kerja
        const hasil = await resolveSourceImage(gambarBySourceId.get(q.sourceId) ?? null);
        if (hasil.status === "blocked") {
          const existing = blocked.find((b) => b.sourceId === q.sourceId);
          if (existing) existing.reasons.push(hasil.reason);
          else blocked.push({ sourceId: q.sourceId, code: q.code, reasons: [hasil.reason] });
          continue;
        }
        if (hasil.status === "none") {
          gambarUntukSoal.set(q.sourceId, null);
          continue;
        }
        const hash = createHash("sha256").update(hasil.bytes).digest("hex");
        const path = importImagePath(hash, hasil.ext);
        let entry = gambarUnik.get(path);
        if (!entry) {
          entry = { path, url: publicImageUrl(path), bytes: hasil.bytes, mime: hasil.mime };
          gambarUnik.set(path, entry);
        }
        gambarUntukSoal.set(q.sourceId, entry);
      }
    }),
  );
  if (blocked.length > 0) {
    throw new ImportBlockedError(blocked);
  }
  if (gambarUnik.size > 0) {
    const gagalUnggah = await uploadImportImages(
      [...gambarUnik.values()].map(({ path, bytes, mime }) => ({ path, bytes, mime })),
    );
    if (gagalUnggah) {
      throw new Error(`Gagal menyimpan gambar ke penyimpanan (${gagalUnggah.error}). Tidak ada yang diimpor - coba lagi.`);
    }
  }

  const stimulusIdMap = new Map<string, string>();
  const stimulusCreates: Prisma.StimulusCreateManyInput[] = preview.stimulusList.map((s) => {
    const id = randomUUID();
    stimulusIdMap.set(s.sourceId, id);
    return { id, tipe: translateStimulusTipe(s.tipe), judul: s.judul, konten: s.konten };
  });

  const packageId = randomUUID();
  const base = Date.now();
  const questionRows: Prisma.QuestionCreateManyInput[] = [];
  const optionRows: Prisma.QuestionOptionCreateManyInput[] = [];
  const categoryRows: Prisma.QuestionCategoryCreateManyInput[] = [];
  const statementRows: Prisma.QuestionStatementCreateManyInput[] = [];

  preview.questions.forEach((q, i) => {
    const questionId = randomUUID();
    questionRows.push({
      id: questionId,
      packageId,
      format: q.format!,
      teks: q.teks,
      media: gambarUntukSoal.get(q.sourceId)?.url ?? null,
      bobot: 1,
      tingkatKesulitan: q.tingkatKesulitan!,
      kompetensiId: q.taxonomyKompetensiId!,
      levelBloom: effectiveLevelBloom.get(q.sourceId)!,
      pembahasan: q.pembahasan,
      stimulusId: q.stimulusId ? (stimulusIdMap.get(q.stimulusId) ?? null) : null,
      createdBy: params.importedBy,
      createdAt: new Date(base + i),
    });

    if (q.format === "pg" || q.format === "pg_kompleks") {
      q.opsi.forEach((o, idx) => {
        optionRows.push({ questionId, label: o.label, teks: o.teks, isCorrect: o.isCorrect, urutan: idx });
      });
    } else if (q.format === "pg_kategori") {
      const categoryIdByLabel = new Map<string, string>();
      q.kategoriRespons.forEach((label, idx) => {
        const categoryId = randomUUID();
        categoryIdByLabel.set(label, categoryId);
        categoryRows.push({ id: categoryId, questionId, label, urutan: idx });
      });
      q.pernyataan.forEach((p, idx) => {
        statementRows.push({
          questionId,
          teks: p.teks,
          urutan: idx,
          correctCategoryId: categoryIdByLabel.get(p.kategoriBenar)!,
        });
      });
    }
  });

  await prisma.$transaction([
    prisma.package.create({
      data: {
        id: packageId,
        ownerType: "pusat",
        ownerId: params.importedBy,
        subjectId: params.subjectId,
        jenjang,
        tingkatList: params.tingkatList,
        nama: `${preview.sourcePaket.nama} (${preview.sourcePaket.code})`,
        durasiMenit: params.durasiMenit,
        jumlahSoal: preview.questions.length,
        kategori: params.kategori,
        status: "draft",
      },
    }),
    ...(stimulusCreates.length > 0 ? [prisma.stimulus.createMany({ data: stimulusCreates })] : []),
    prisma.question.createMany({ data: questionRows }),
    ...(optionRows.length > 0 ? [prisma.questionOption.createMany({ data: optionRows })] : []),
    ...(categoryRows.length > 0 ? [prisma.questionCategory.createMany({ data: categoryRows })] : []),
    ...(statementRows.length > 0 ? [prisma.questionStatement.createMany({ data: statementRows })] : []),
    prisma.soalImportLog.create({
      data: {
        sourcePaketId: preview.sourcePaket.id,
        sourcePaketCode: preview.sourcePaket.code,
        packageId,
        importedBy: params.importedBy,
      },
    }),
  ]);

  const pkg = await prisma.package.findUniqueOrThrow({ where: { id: packageId } });
  return { package: pkg, jumlahSoal: preview.questions.length };
}
