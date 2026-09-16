import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { getActiveAssignmentsFor, getSelfSelectPackagesFor, getSelfSelectTryOutGroupsFor } from "@/lib/exam/visibility";
import { sanitizeAttemptForClient } from "@/lib/exam/attempt-access";
import { isExpired } from "@/lib/exam/timing";
import { finalizeAttempt } from "@/lib/exam/finalize";
import { canStartAttempt, type AccessCheckResult } from "@/lib/billing/entitlements";
import { z } from "zod";

/**
 * Bagian 9 kasus tepi #6: waiting_for_seat beda dari quota_required biasa -
 * pesannya menjelaskan bahwa ini otomatis pulih begitu admin menambah
 * kuota, bukan jalan buntu yang perlu tindakan siswa (mis. beli paket).
 */
function accessDeniedResponse(access: Extract<AccessCheckResult, { allowed: false }>, quotaRequiredMessage: string) {
  if (access.reason === "waiting_for_seat") {
    return NextResponse.json(
      {
        error:
          "Kuota kursi sekolahmu sedang penuh. Begitu admin pusat menambah kuota, kamu otomatis bisa mulai try out lagi - tidak perlu mendaftar ulang.",
        code: "WAITING_FOR_SEAT",
      },
      { status: 402 },
    );
  }
  return NextResponse.json({ error: quotaRequiredMessage, code: "QUOTA_REQUIRED" }, { status: 402 });
}

// POST handler memanggil finalizeAttempt (saat expired) yang memicu AI via after().
export const maxDuration = 300;

const startAttemptSchema = z
  .object({
    assignmentId: z.string().uuid().optional(),
    packageId: z.string().uuid().optional(),
    // Bagian 8/10 (permintaan user, "paket soal yang banyak, diacak"): siswa
    // pilih grup try out, server yang memilihkan satu variasi soal secara
    // acak - lihat cabang tryOutGroupId di bawah.
    tryOutGroupId: z.string().uuid().optional(),
  })
  .refine((d) => [d.assignmentId, d.packageId, d.tryOutGroupId].filter(Boolean).length === 1, {
    message: "Isi salah satu: assignmentId, packageId, atau tryOutGroupId.",
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
  let chosenPackage: { id: string; subjectId: string } | null = null;
  // Bagian 8/10: kalau diisi, "existing attempt" & jatah maxAttempt dicek
  // lintas SEMUA variasi paket dalam grup ini (bukan cuma variasi yang
  // kebetulan terpilih acak kali ini) - lihat komentar di masing-masing query di bawah.
  let tryOutGroupId: string | null = null;

  if (parsed.data.assignmentId) {
    const active = await getActiveAssignmentsFor(student);
    assignment = active.find((a) => a.id === parsed.data.assignmentId) ?? null;
    if (!assignment) {
      return NextResponse.json(
        { error: "Ujian tidak ditemukan atau jendela waktunya sudah tutup." },
        { status: 404 },
      );
    }

    const fullPkg = await prisma.package.findUnique({
      where: { id: assignment.packageId },
      select: { subjectId: true },
    });
    if (fullPkg) {
      const access = await canStartAttempt(student.id, fullPkg.subjectId, student.schoolId);
      if (!access.allowed) {
        return accessDeniedResponse(access, "Kuota try out untuk mata pelajaran ini sudah habis. Hubungi admin sekolahmu.");
      }
    }
  } else if (parsed.data.tryOutGroupId) {
    const groups = await getSelfSelectTryOutGroupsFor(student);
    const group = groups.find((g) => g.id === parsed.data.tryOutGroupId) ?? null;
    if (!group) {
      return NextResponse.json(
        { error: "Try out tidak ditemukan atau tidak tersedia untukmu." },
        { status: 404 },
      );
    }
    tryOutGroupId = group.id;

    // Variasi soal dipilih SECARA ACAK di sini - kalau nanti ternyata ada
    // attempt berjalan/paused untuk grup ini (lihat query "existing" di
    // bawah), variasi acak ini diabaikan dan attempt lama itulah yang dipakai.
    const variants = await prisma.package.findMany({
      where: { tryOutGroupId: group.id, status: "published" },
      select: { id: true, subjectId: true },
    });
    if (variants.length === 0) {
      return NextResponse.json(
        { error: "Try out ini belum punya variasi soal yang siap dikerjakan." },
        { status: 404 },
      );
    }
    chosenPackage = variants[Math.floor(Math.random() * variants.length)]!;

    const access = await canStartAttempt(student.id, chosenPackage.subjectId, student.schoolId);
    if (!access.allowed) {
      return accessDeniedResponse(
        access,
        "Kamu belum memiliki akses try out untuk mata pelajaran ini. Beli paket untuk membuka akses.",
      );
    }
  } else {
    const options = await getSelfSelectPackagesFor(student);
    chosenPackage = options.find((p) => p.id === parsed.data.packageId) ?? null;
    if (!chosenPackage) {
      return NextResponse.json(
        { error: "Paket tidak ditemukan atau tidak tersedia untukmu." },
        { status: 404 },
      );
    }

    const access = await canStartAttempt(student.id, chosenPackage.subjectId, student.schoolId);
    if (!access.allowed) {
      return accessDeniedResponse(
        access,
        "Kamu belum memiliki akses try out untuk mata pelajaran ini. Beli paket untuk membuka akses.",
      );
    }
  }

  const existing = await prisma.attempt.findFirst({
    where: assignment
      ? { studentId: student.id, assignmentId: assignment.id }
      : tryOutGroupId
        ? { studentId: student.id, package: { tryOutGroupId }, assignmentId: null }
        : { studentId: student.id, packageId: chosenPackage!.id, assignmentId: null },
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
      return NextResponse.json({ attempt: sanitizeAttemptForClient(existing) });
    }
    await finalizeAttempt(null, existing.id, "kedaluwarsa");
  }

  const packageId = assignment ? assignment.packageId : chosenPackage!.id;
  const fullPackage = await prisma.package.findUniqueOrThrow({
    where: { id: packageId },
    include: { questions: { where: { deletedAt: null } } },
  });

  if (fullPackage.maxAttempt != null) {
    const finishedCount = await prisma.attempt.count({
      where: assignment
        ? { studentId: student.id, assignmentId: assignment.id, status: { in: ["selesai", "kedaluwarsa"] } }
        : tryOutGroupId
          ? {
              studentId: student.id,
              package: { tryOutGroupId },
              assignmentId: null,
              status: { in: ["selesai", "kedaluwarsa"] },
            }
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
    const created = await tx.attempt.create({
      data: {
        studentId: student.id,
        packageId: fullPackage.id,
        assignmentId: assignment?.id ?? null,
        mulaiAt: new Date(),
        sisaDetik: fullPackage.durasiMenit * 60,
        status: "berjalan",
        ip,
        userAgent,
      },
    });

    await tx.attemptAnswer.createMany({
      data: fullPackage.questions.map((q) => ({
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
  return NextResponse.json({ attempt: sanitizeAttemptForClient(attempt) }, { status: 201 });
}
