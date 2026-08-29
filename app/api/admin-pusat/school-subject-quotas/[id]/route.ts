import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const upsertSchema = z.object({
  subjectId: z.string().uuid(),
  tryOutPerSiswa: z.number().int().min(1).max(100),
  kuotaSiswa: z.number().int().min(1).max(100000),
});

/** GET /api/admin-pusat/school-subject-quotas/[id] — daftar kuota try out mapel per sekolah */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await params;

  const [quotas, subjects] = await Promise.all([
    prisma.schoolSubjectQuota.findMany({
      where: { schoolId },
      include: { subject: { select: { id: true, nama: true, jenjang: true } } },
      orderBy: { subject: { nama: "asc" } },
    }),
    prisma.subject.findMany({ orderBy: { nama: "asc" } }),
  ]);

  return NextResponse.json({ quotas, subjects });
}

/** POST /api/admin-pusat/school-subject-quotas/[id] — tambah atau ubah kuota mapel */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await params;
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { subjectId, tryOutPerSiswa, kuotaSiswa } = parsed.data;

  const before = await prisma.schoolSubjectQuota.findUnique({
    where: { schoolId_subjectId: { schoolId, subjectId } },
  });

  const quota = await prisma.schoolSubjectQuota.upsert({
    where: { schoolId_subjectId: { schoolId, subjectId } },
    create: { schoolId, subjectId, tryOutPerSiswa, kuotaSiswa, createdBy: user.id },
    update: { tryOutPerSiswa, kuotaSiswa },
  });

  await logAudit({
    userId: user.id,
    aksi: before ? "update" : "create",
    entitas: "school_subject_quotas",
    entitasId: quota.id,
    before,
    after: quota,
    ip: getClientIp(request),
  });

  return NextResponse.json({ quota }, { status: before ? 200 : 201 });
}

/** DELETE /api/admin-pusat/school-subject-quotas/[id]?subjectId=... — hapus kuota mapel */
export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await params;
  const url = new URL(request.url);
  const subjectId = url.searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ error: "subjectId wajib diisi." }, { status: 400 });
  }

  const before = await prisma.schoolSubjectQuota.findUnique({
    where: { schoolId_subjectId: { schoolId, subjectId } },
  });
  if (!before) {
    return NextResponse.json({ error: "Kuota tidak ditemukan." }, { status: 404 });
  }

  await prisma.schoolSubjectQuota.delete({
    where: { schoolId_subjectId: { schoolId, subjectId } },
  });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "school_subject_quotas",
    entitasId: before.id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
