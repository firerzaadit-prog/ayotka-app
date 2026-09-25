import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";

type RouteParams = { params: Promise<{ id: string }> };

const MAKS_PANJANG_PEMBAHASAN = 20_000;
const MAKS_SOAL_PER_SIMPAN = 300;

/**
 * Editor pembahasan massal (halaman Bank Soal > paket > "Isi Pembahasan").
 * Urutan SAMA dengan tabel soal di detail paket (GET /api/packages/[id],
 * terbaru di atas) supaya nomor yang dilihat admin di sana cocok dengan
 * nomor di editor ini.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsPackage(user, id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const pkg = await prisma.package.findUnique({
    where: { id },
    select: {
      id: true,
      nama: true,
      status: true,
      questions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          format: true,
          teks: true,
          pembahasan: true,
          options: { orderBy: { urutan: "asc" }, select: { label: true, teks: true, isCorrect: true } },
          statements: {
            orderBy: { urutan: "asc" },
            select: { teks: true, correctCategory: { select: { label: true } } },
          },
        },
      },
    },
  });
  if (!pkg) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({
    package: { id: pkg.id, nama: pkg.nama, status: pkg.status },
    questions: pkg.questions.map((q, i) => ({
      id: q.id,
      nomor: i + 1,
      format: q.format,
      teks: q.teks,
      pembahasan: q.pembahasan ?? "",
      // Kunci jawaban ditampilkan supaya penulis pembahasan tidak perlu buka
      // soalnya satu-satu: "C. Jumat" untuk PG/PG Kompleks, "pernyataan -> Benar" untuk PG Kategori.
      kunci:
        q.format === "pg_kategori"
          ? q.statements.map((s) => `${s.teks} → ${s.correctCategory.label}`)
          : q.options.filter((o) => o.isCorrect).map((o) => `${o.label}. ${o.teks}`),
    })),
  });
}

const simpanSchema = z.object({
  items: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        pembahasan: z
          .string()
          .max(MAKS_PANJANG_PEMBAHASAN, `Pembahasan maksimal ${MAKS_PANJANG_PEMBAHASAN} karakter per soal.`),
      }),
    )
    .min(1, "Tidak ada perubahan yang dikirim.")
    .max(MAKS_SOAL_PER_SIMPAN, `Maksimal ${MAKS_SOAL_PER_SIMPAN} soal per simpan.`),
});

/**
 * Simpan pembahasan beberapa soal sekaligus. HANYA kolom pembahasan yang
 * disentuh - tidak ada perubahan pada teks soal, opsi, kunci, atau nilai
 * siswa - jadi aman dipakai kapan saja: termasuk saat paket sedang
 * published dan soalnya sudah pernah dijawab (beda dari edit soal penuh di
 * PATCH /api/questions/[id], yang terkunci untuk kasus itu). Pembahasan
 * kosong ("") menghapus pembahasan soal itu.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsPackage(user, id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = simpanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  // Satu soal hanya boleh muncul sekali; kalau duplikat, yang terakhir menang.
  const perSoal = new Map(parsed.data.items.map((it) => [it.questionId, it.pembahasan.trim()] as const));
  const ids = [...perSoal.keys()];

  // Semua soal HARUS milik paket ini dan belum dihapus - mencegah menulis ke
  // soal paket lain lewat ID yang ditebak.
  const valid = await prisma.question.findMany({
    where: { id: { in: ids }, packageId: id, deletedAt: null },
    select: { id: true },
  });
  if (valid.length !== ids.length) {
    return NextResponse.json(
      { error: "Ada soal yang bukan bagian paket ini atau sudah dihapus. Muat ulang halaman lalu coba lagi." },
      { status: 400 },
    );
  }

  await prisma.$transaction(
    ids.map((qid) =>
      prisma.question.update({
        where: { id: qid },
        data: { pembahasan: perSoal.get(qid)! || null },
      }),
    ),
  );

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "packages",
    entitasId: id,
    after: { pembahasanDiperbarui: ids.length, questionIds: ids },
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true, diperbarui: ids.length });
}
