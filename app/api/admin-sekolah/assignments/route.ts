import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { assignmentCreateSchema } from "@/lib/validations/assignment";

/** Tiket 4.2: penugasan ujian oleh admin sekolah - pilih paket, kelas, jendela waktu, metode distribusi. */
export async function GET() {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const assignments = await prisma.assignment.findMany({
    where: { schoolId },
    orderBy: { mulai: "desc" },
    include: {
      package: { select: { nama: true, jumlahSoal: true, durasiMenit: true } },
      class: { select: { tingkat: true, namaRombel: true } },
      _count: { select: { attempts: true } },
    },
  });

  return NextResponse.json({ assignments });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = assignmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const kelas = await prisma.class.findUnique({ where: { id: parsed.data.classId } });
  if (!kelas || kelas.schoolId !== schoolId) {
    return NextResponse.json({ error: "Rombel tidak ditemukan." }, { status: 404 });
  }

  const pkg = await prisma.package.findUnique({ where: { id: parsed.data.packageId } });
  // ownerType "pusat" eksplisit di cabang visibility - lihat komentar serupa
  // di app/api/admin-sekolah/paket-tersedia/route.ts.
  const bolehDipakai =
    pkg?.status === "published" &&
    (
      (pkg.ownerType === "sekolah" && pkg.ownerId === schoolId) ||
      (pkg.ownerType === "pusat" &&
        (await prisma.packageVisibility.findFirst({
          where: {
            packageId: pkg.id,
            OR: [{ targetType: "semua" }, { targetType: "sekolah", schoolId }],
          },
        })) !== null)
    );
  if (!pkg || !bolehDipakai) {
    return NextResponse.json({ error: "Paket soal tidak ditemukan atau tidak tersedia." }, { status: 404 });
  }

  const assignment = await prisma.assignment.create({
    data: {
      packageId: pkg.id,
      classId: kelas.id,
      schoolId,
      mulai: parsed.data.mulai,
      selesai: parsed.data.selesai,
      metodeDistribusi: parsed.data.metodeDistribusi,
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "assignments",
    entitasId: assignment.id,
    after: assignment,
    ip: getClientIp(request),
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
