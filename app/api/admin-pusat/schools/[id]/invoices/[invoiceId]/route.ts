import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { schoolInvoiceUpdateSchema } from "@/lib/validations/school-invoice";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; invoiceId: string }> },
) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId, invoiceId } = await context.params;
  const existing = await prisma.schoolInvoice.findFirst({
    where: { id: invoiceId, schoolId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schoolInvoiceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { status, jumlahSiswa, hargaPerSiswa, jatuhTempo, keterangan, bankTujuan, catatan } = parsed.data;

  const dataToUpdate: Prisma.SchoolInvoiceUpdateInput = {};

  if (status) {
    dataToUpdate.status = status;
    if (status === "lunas" && existing.status !== "lunas") {
      dataToUpdate.dibayarAt = new Date();
    } else if (status !== "lunas") {
      dataToUpdate.dibayarAt = null;
    }
  }

  if (jumlahSiswa !== undefined || hargaPerSiswa !== undefined) {
    const finalJumlah = jumlahSiswa ?? existing.jumlahSiswa;
    const finalHarga = hargaPerSiswa ?? existing.hargaPerSiswa;
    dataToUpdate.jumlahSiswa = finalJumlah;
    dataToUpdate.hargaPerSiswa = finalHarga;
    dataToUpdate.subtotal = finalJumlah * finalHarga;
    dataToUpdate.totalAmount = finalJumlah * finalHarga;
  }

  if (jatuhTempo) {
    dataToUpdate.jatuhTempo = new Date(jatuhTempo);
  }

  if (keterangan !== undefined) dataToUpdate.keterangan = keterangan?.trim() || null;
  if (bankTujuan !== undefined) dataToUpdate.bankTujuan = bankTujuan?.trim() || null;
  if (catatan !== undefined) dataToUpdate.catatan = catatan?.trim() || null;

  const updated = await prisma.schoolInvoice.update({
    where: { id: invoiceId },
    data: dataToUpdate,
    include: {
      periode: { select: { nama: true, mulai: true, berakhir: true } },
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "school_invoices",
    entitasId: invoiceId,
    before: existing,
    after: updated,
    ip: getClientIp(request),
  });

  return NextResponse.json({ invoice: updated });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; invoiceId: string }> },
) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId, invoiceId } = await context.params;
  const existing = await prisma.schoolInvoice.findFirst({
    where: { id: invoiceId, schoolId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }

  await prisma.schoolInvoice.delete({ where: { id: invoiceId } });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "school_invoices",
    entitasId: invoiceId,
    before: existing,
    ip: getClientIp(request),
  });

  return NextResponse.json({ success: true });
}
