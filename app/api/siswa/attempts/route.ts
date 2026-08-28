import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { pickPackageForAttempt } from "@/lib/exam/distribution";
import { getActiveAssignmentsFor, getSelfSelectPackagesFor } from "@/lib/exam/visibility";
import { isExpired } from "@/lib/exam/timing";
import { finalizeAttempt } from "@/lib/exam/finalize";
import { canStartViaSubjectQuota, consumeSubjectTryOut } from "@/lib/billing/subject-tryout";
import { z } from "zod";

const startAttemptSchema = z
  .object({
    assignmentId: z.string().uuid().optional(),
    packageId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.assignmentId) !== Boolean(d.packageId), {
    message: "Isi salah satu: assignmentId atau packageId.",
  });

/**
 * Tiket 5.6: riwayat - semua attempt siswa sepanjang waktu (bukan cuma
 * yang terbaru per paket seperti di /api/siswa/ujian), tetap bisa dibuka
 * kapan saja. Tidak ada pengecekan status langganan di sini secara
 * sengaja - riwayat harus tetap terbuka meski akun mandiri kedaluwarsa
 * (Bagian 7.1 brief), cuma mulai attempt baru yang boleh terkunci.
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const attempts = await prisma.attempt.findMany({
    where: { studentId: student.id },
    orderBy: { mulaiAt: "desc" },
    include: {
      package: { select: { nama: true } },
      assignment: { select: { class: { select: { tingkat: true, namaRombel: true } } } },
    },
  });

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      paketNama: a.package.nama,
      kelas: a.assignment?.class ? `${a.assignment.class.tingkat}${a.assignment.class.namaRombel}` : null,
      status: a.status,
      skorAkhir: a.skorAkhir,
      mulaiAt: a.mulaiAt,
      selesaiAt: a.selesaiAt,
    })),
  });
}

/**
 * Tiket 4.3/4.4: mulai atau lanjutkan attempt. Attempt "berjalan" yang
 * belum kedaluwarsa untuk assignment/paket yang sama langsung
 * dikembalikan (resume alami saat refresh halaman) alih-alih membuat
 * baru - mencegah siswa membuka banyak attempt paralel untuk penugasan
 * yang sama.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = startAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  let assignment = null as Awaited<ReturnType<typeof getActiveAssignmentsFor>>[number] | null;
  let packageForMandiri: Awaited<ReturnType<typeof getSelfSelectPackagesFor>>[number] | null = null;
  let subjectIdToConsumeQuota: string | null = null;

  if (parsed.data.assignmentId) {
    const active = await getActiveAssignmentsFor(student);
    assignment = active.find((a) => a.id === parsed.data.assignmentId) ?? null;
    if (!assignment) {
      return NextResponse.json(
        { error: "Ujian tidak ditemukan atau jendela waktunya sudah tutup." },
        { status: 404 },
      );
    }
  } else {
    const options = await getSelfSelectPackagesFor(student);
    packageForMandiri = options.find((p) => p.id === parsed.data.packageId) ?? null;
    if (!packageForMandiri) {
      return NextResponse.json(
        { error: "Paket tidak ditemukan atau tidak tersedia untukmu." },
        { status: 404 },
      );
    }

    if (student.jalur === "B") {
      const quotaAllowed = await canStartViaSubjectQuota(user.id, packageForMandiri.subjectId);
      if (!quotaAllowed) {
        return NextResponse.json(
          {
            error:
              "Kamu belum memiliki kuota try out untuk mata pelajaran ini. Beli paket try out untuk membuka akses.",
            code: "QUOTA_REQUIRED",
          },
          { status: 402 },
        );
      }
      subjectIdToConsumeQuota = packageForMandiri.subjectId;
    }
  }

  const existing = await prisma.attempt.findFirst({
    where: assignment
      ? { studentId: student.id, assignmentId: assignment.id }
      : { studentId: student.id, packageId: packageForMandiri!.id, assignmentId: null },
    orderBy: { mulaiAt: "desc" },
  });

  if (existing && (existing.status === "berjalan" || existing.status === "paused")) {
    if (existing.status === "paused") {
      return NextResponse.json(
        { error: "Sesi ujian ini sedang dijeda admin sekolah. Hubungi admin untuk melanjutkan." },
        { status: 409 },
      );
    }
    if (!isExpired(existing)) {
      return NextResponse.json({ attempt: existing });
    }
    await prisma.$transaction((tx) => finalizeAttempt(tx, existing.id, "kedaluwarsa"));
  }

  const packageId = assignment ? assignment.packageId : packageForMandiri!.id;
  const fullPackage = await prisma.package.findUniqueOrThrow({
    where: { id: packageId },
    include: { questions: { where: { deletedAt: null } } },
  });

  if (fullPackage.maxAttempt != null) {
    const finishedCount = await prisma.attempt.count({
      where: assignment
        ? { studentId: student.id, assignmentId: assignment.id, status: { in: ["selesai", "kedaluwarsa"] } }
        : {
            studentId: student.id,
            packageId: fullPackage.id,
            assignmentId: null,
            status: { in: ["selesai", "kedaluwarsa"] },
          },
    });
    if (finishedCount >= fullPackage.maxAttempt) {
      return NextResponse.json(
        { error: "Kesempatan mengerjakan paket ini sudah habis." },
        { status: 409 },
      );
    }
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const attempt = await prisma.$transaction(async (tx) => {
    const finalPackage = assignment
      ? await pickPackageForAttempt(tx, { ...assignment, package: fullPackage })
      : fullPackage;

    const questions =
      finalPackage.id === fullPackage.id
        ? fullPackage.questions
        : (
            await tx.package.findUniqueOrThrow({
              where: { id: finalPackage.id },
              include: { questions: { where: { deletedAt: null } } },
            })
          ).questions;

    const created = await tx.attempt.create({
      data: {
        studentId: student.id,
        packageId: finalPackage.id,
        assignmentId: assignment?.id ?? null,
        mulaiAt: new Date(),
        sisaDetik: finalPackage.durasiMenit * 60,
        status: "berjalan",
        ip,
        userAgent,
      },
    });

    await tx.attemptAnswer.createMany({
      data: questions.map((q) => ({
        attemptId: created.id,
        questionId: q.id,
        skorMaks: q.bobot,
      })),
    });

    return created;
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "attempts",
    entitasId: attempt.id,
    after: attempt,
    ip,
  });
  if (subjectIdToConsumeQuota) {
    await consumeSubjectTryOut(user.id, subjectIdToConsumeQuota);
  }

  return NextResponse.json({ attempt }, { status: 201 });
}
