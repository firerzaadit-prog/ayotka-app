import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { bankAccountUpdateSchema } from "@/lib/validations/bank-account";

type RouteParams = { params: Promise<{ id: string }> };

/** Tiket 6.2: nonaktifkan (default) atau edit detail rekening. */
export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.bankAccount.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Rekening tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bankAccountUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const bankAccount = await prisma.bankAccount.update({ where: { id }, data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "bank_accounts",
    entitasId: id,
    before,
    after: bankAccount,
    ip: getClientIp(request),
  });

  return NextResponse.json({ bankAccount });
}

/** Rekening tidak direferensikan tabel lain (nomor rekening cuma ditampilkan saat checkout), jadi aman dihapus permanen. */
export async function DELETE(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const before = await prisma.bankAccount.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Rekening tidak ditemukan." }, { status: 404 });
  }

  await prisma.bankAccount.delete({ where: { id } });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "bank_accounts",
    entitasId: id,
    before,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
