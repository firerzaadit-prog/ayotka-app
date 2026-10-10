import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { schoolInvoiceCreateSchema } from "@/lib/validations/school-invoice";
import { generateNomorInvoiceSekolah } from "@/lib/billing/school-invoice";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await context.params;
  const invoices = await prisma.schoolInvoice.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    include: {
      periode: { select: { nama: true, mulai: true, berakhir: true } },
    },
  });

  return NextResponse.json({ invoices });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId } = await context.params;
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schoolInvoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { jumlahSiswa, hargaPerSiswa, jatuhTempo, keterangan, bankTujuan, catatan, periodeId } = parsed.data;
  const subtotal = jumlahSiswa * hargaPerSiswa;
  const totalAmount = subtotal;
  const nomorInvoice = await generateNomorInvoiceSekolah();

  const invoice = await prisma.schoolInvoice.create({
    data: {
      schoolId,
      nomorInvoice,
      jumlahSiswa,
      hargaPerSiswa,
      subtotal,
      totalAmount,
      status: "menunggu_pembayaran",
      jatuhTempo: new Date(jatuhTempo),
      keterangan: keterangan?.trim() || null,
      bankTujuan: bankTujuan?.trim() || null,
      catatan: catatan?.trim() || null,
      periodeId: periodeId || null,
      dibuatOlehId: user.id,
    },
    include: {
      periode: { select: { nama: true, mulai: true, berakhir: true } },
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "school_invoices",
    entitasId: invoice.id,
    after: invoice,
    ip: getClientIp(request),
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
