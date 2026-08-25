import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { orderCreateSchema } from "@/lib/validations/order";
import { uploadBuktiTransfer } from "@/lib/supabase/bukti-transfer";

/** Tiket 6.3: riwayat order siswa mandiri sendiri, untuk halaman checkout/status langganan. */
export async function GET() {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { nama: true, harga: true, durasiHari: true } } },
  });

  return NextResponse.json({ orders });
}

/**
 * Tiket 6.3: siswa mandiri unggah bukti transfer + pilih paket -> Order
 * "menunggu_verifikasi". Tiket 6.7 (perpanjangan) pakai endpoint yang sama -
 * order baru dibuat dengan cara yang identik, bedanya cuma nanti saat ACC
 * (Tiket 6.4) sistem mendeteksi apakah user sudah punya subscription usable
 * (perpanjang) atau belum (baru).
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
      { error: "Langganan berbayar hanya untuk siswa mandiri. Akunmu terdaftar lewat sekolah." },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const parsed = orderCreateSchema.safeParse({ planId: formData.get("planId") });
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

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || plan.target !== "siswa") {
    return NextResponse.json({ error: "Paket langganan tidak ditemukan." }, { status: 404 });
  }

  const pendingOrder = await prisma.order.findFirst({
    where: { userId: user.id, status: "menunggu_verifikasi" },
  });
  if (pendingOrder) {
    return NextResponse.json(
      { error: "Kamu masih punya order yang belum diverifikasi admin. Tunggu itu diproses dulu." },
      { status: 409 },
    );
  }

  const uploadResult = await uploadBuktiTransfer(file, user.id);
  if ("error" in uploadResult) {
    return NextResponse.json({ error: uploadResult.error }, { status: 400 });
  }

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      planId: plan.id,
      jumlah: plan.harga,
      status: "menunggu_verifikasi",
      buktiTransferUrl: uploadResult.path,
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "orders",
    entitasId: order.id,
    after: order,
    ip: getClientIp(request),
  });

  return NextResponse.json({ order }, { status: 201 });
}
