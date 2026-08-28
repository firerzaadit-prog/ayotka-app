import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { subjectTryOutOrderCreateSchema } from "@/lib/validations/order";
import { uploadBuktiTransfer } from "@/lib/supabase/bukti-transfer";

/** Bagian 7.3 brief: riwayat order paket try out per mapel milik siswa mandiri sendiri. */
export async function GET() {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const orders = await prisma.subjectTryOutOrder.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { subject: { select: { nama: true } } } },
      servicePackage: { select: { nama: true, hargaPerMapel: true, tryOutPerMapel: true } },
    },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      jumlah: o.jumlah,
      status: o.status,
      catatanAdmin: o.catatanAdmin,
      createdAt: o.createdAt,
      mapel: o.items.map((i) => i.subject.nama),
      paket: o.servicePackage.nama,
      tryOutPerMapel: o.servicePackage.tryOutPerMapel,
    })),
  });
}

/**
 * Bagian 7.3 brief: siswa mandiri pilih paket layanan + 1+ mata pelajaran +
 * unggah bukti transfer → 1 SubjectTryOutOrder "menunggu_verifikasi".
 * Harga = hargaPerMapel (dari ServicePackage) × jumlah mapel.
 */
export async function POST(request: Request) {
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
  if (student.jalur !== "B") {
    return NextResponse.json(
      { error: "Paket try out per mapel hanya untuk siswa mandiri. Akunmu terdaftar lewat sekolah." },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const parsed = subjectTryOutOrderCreateSchema.safeParse({
    subjectIds: formData.getAll("subjectIds"),
    servicePackageId: formData.get("servicePackageId"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Bukti transfer wajib diunggah." }, { status: 400 });
  }

  // Validasi paket layanan aktif
  const servicePackage = await prisma.servicePackage.findUnique({
    where: { id: parsed.data.servicePackageId },
  });
  if (!servicePackage || !servicePackage.isActive) {
    return NextResponse.json({ error: "Paket layanan tidak ditemukan atau tidak aktif." }, { status: 404 });
  }

  const subjectIds = [...new Set(parsed.data.subjectIds)];
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds }, jenjang: student.jenjang },
  });
  if (subjects.length !== subjectIds.length) {
    return NextResponse.json({ error: "Salah satu mata pelajaran tidak ditemukan." }, { status: 404 });
  }

  const pendingOrder = await prisma.subjectTryOutOrder.findFirst({
    where: { userId: user.id, status: "menunggu_verifikasi" },
  });
  if (pendingOrder) {
    return NextResponse.json(
      { error: "Kamu masih punya order try out mapel yang belum diverifikasi admin. Tunggu itu diproses dulu." },
      { status: 409 },
    );
  }

  const uploadResult = await uploadBuktiTransfer(file, user.id);
  if ("error" in uploadResult) {
    return NextResponse.json({ error: uploadResult.error }, { status: 400 });
  }

  const order = await prisma.subjectTryOutOrder.create({
    data: {
      userId: user.id,
      servicePackageId: servicePackage.id,
      jumlah: servicePackage.hargaPerMapel * subjectIds.length,
      status: "menunggu_verifikasi",
      buktiTransferUrl: uploadResult.path,
      items: { create: subjectIds.map((subjectId) => ({ subjectId })) },
    },
    include: { items: true },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "subject_tryout_orders",
    entitasId: order.id,
    after: order,
    ip: getClientIp(request),
  });

  return NextResponse.json({ order }, { status: 201 });
}
