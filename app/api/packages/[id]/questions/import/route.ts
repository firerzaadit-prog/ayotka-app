import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAKS_BARIS_IMPOR, readSoalSheet } from "@/lib/soal/excel-io";
import { loadKompetensiForSubject } from "@/lib/soal/kompetensi-ref";
import { normalizeTeks, rowsToQuestions } from "@/lib/soal/excel-format";

export const maxDuration = 60;

type RouteParams = { params: Promise<{ id: string }> };

const MAKS_UKURAN_BYTE = 5 * 1024 * 1024;
const MAKS_ERROR_DITAMPILKAN = 100;

/**
 * Impor soal dari Excel ke satu paket (format kolom: lihat lib/soal/excel-format.ts,
 * sama dengan hasil unduhan endpoint export). Semua-atau-tidak-sama-sekali:
 * kalau ada satu baris salah, tidak ada yang disimpan dan seluruh kesalahan
 * dikembalikan. Soal dengan teks yang sudah ada di paket dilewati, jadi
 * mengunggah file yang sama dua kali tidak menggandakan soal.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: packageId } = await params;
  if (!(await assertOwnsPackage(user, packageId))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }
  if (!checkRateLimit(`import-soal:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan impor, coba lagi sebentar lagi." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
  }
  if (file.size > MAKS_UKURAN_BYTE) {
    return NextResponse.json({ error: "Ukuran file maksimal 5 MB." }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  // .xlsx adalah arsip ZIP - tolak file lain (mis. .xls lama, .csv, atau file salah) dengan pesan yang jelas.
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return NextResponse.json({ error: "File harus berformat .xlsx (Excel). Simpan ulang dari Excel sebagai \"Excel Workbook (.xlsx)\"." }, { status: 400 });
  }

  let sheet;
  try {
    sheet = await readSoalSheet(buffer);
  } catch {
    return NextResponse.json({ error: "Gagal membaca file. Pastikan file .xlsx valid dan tidak diproteksi password." }, { status: 400 });
  }
  if (sheet.missingHeaders.length > 0) {
    return NextResponse.json(
      { error: `Kolom wajib tidak ditemukan di baris 1: ${sheet.missingHeaders.join(", ")}. Gunakan template dari tombol "Unduh template".` },
      { status: 422 },
    );
  }
  if (sheet.rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada baris soal yang terisi (baris 2 ke bawah)." }, { status: 400 });
  }
  if (sheet.rows.length > MAKS_BARIS_IMPOR) {
    return NextResponse.json({ error: `Maksimal ${MAKS_BARIS_IMPOR} soal per file (ada ${sheet.rows.length}). Pecah menjadi beberapa file.` }, { status: 400 });
  }

  const pkg = await prisma.package.findUniqueOrThrow({ where: { id: packageId }, select: { subjectId: true } });
  const { byKode } = await loadKompetensiForSubject(pkg.subjectId);
  const { questions, errors } = rowsToQuestions(sheet.rows, byKode);

  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: `Ada ${errors.length} kesalahan di file. Tidak ada soal yang disimpan - perbaiki lalu unggah lagi.`,
        errors: errors.slice(0, MAKS_ERROR_DITAMPILKAN),
        totalErrors: errors.length,
      },
      { status: 422 },
    );
  }

  // Lewati soal yang sudah ada di paket (atau duplikat di dalam file itu sendiri).
  const existing = await prisma.question.findMany({ where: { packageId, deletedAt: null }, select: { teks: true } });
  const seen = new Set(existing.map((q) => normalizeTeks(q.teks)));
  const dilewati: Array<{ row: number; alasan: string }> = [];
  const baru = questions.filter((q) => {
    const key = normalizeTeks(q.data.teks);
    if (seen.has(key)) {
      dilewati.push({ row: q.row, alasan: "Teks soal sama dengan soal yang sudah ada." });
      return false;
    }
    seen.add(key);
    return true;
  });

  if (baru.length === 0) {
    return NextResponse.json({ imported: 0, dilewati, unknownHeaders: sheet.unknownHeaders });
  }

  // createdAt diberi selisih 1 ms per soal: dalam satu transaksi now() sama untuk semua baris,
  // padahal urutan tampil/ekspor soal bergantung pada createdAt.
  const base = Date.now();
  const questionRows: Prisma.QuestionCreateManyInput[] = [];
  const optionRows: Prisma.QuestionOptionCreateManyInput[] = [];
  const categoryRows: Prisma.QuestionCategoryCreateManyInput[] = [];
  const statementRows: Prisma.QuestionStatementCreateManyInput[] = [];

  baru.forEach(({ data }, i) => {
    const id = randomUUID();
    questionRows.push({
      id,
      packageId,
      format: data.format,
      createdBy: user.id,
      teks: data.teks,
      media: data.media,
      bobot: data.bobot,
      tingkatKesulitan: data.tingkatKesulitan,
      kompetensiId: data.kompetensiId,
      materiId: data.materiId,
      subMateriId: data.subMateriId,
      levelBloom: data.levelBloom,
      pembahasan: data.pembahasan,
      createdAt: new Date(base + i),
    });

    if (data.format === "pg" || data.format === "pg_kompleks") {
      for (const o of data.options) optionRows.push({ questionId: id, ...o });
    } else {
      const benarId = randomUUID();
      const salahId = randomUUID();
      categoryRows.push({ id: benarId, questionId: id, label: "Benar", urutan: 0 });
      categoryRows.push({ id: salahId, questionId: id, label: "Salah", urutan: 1 });
      for (const s of data.statements) {
        statementRows.push({
          questionId: id,
          teks: s.teks,
          media: s.media,
          urutan: s.urutan,
          correctCategoryId: s.correctCategory === "Benar" ? benarId : salahId,
        });
      }
    }
  });

  await prisma.$transaction([
    prisma.question.createMany({ data: questionRows }),
    ...(optionRows.length ? [prisma.questionOption.createMany({ data: optionRows })] : []),
    ...(categoryRows.length ? [prisma.questionCategory.createMany({ data: categoryRows })] : []),
    ...(statementRows.length ? [prisma.questionStatement.createMany({ data: statementRows })] : []),
  ]);

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "questions",
    entitasId: packageId,
    after: { impor: "excel", jumlah: baru.length, dilewati: dilewati.length, file: file.name },
    ip: getClientIp(request),
  });

  return NextResponse.json({ imported: baru.length, dilewati, unknownHeaders: sheet.unknownHeaders }, { status: 201 });
}
