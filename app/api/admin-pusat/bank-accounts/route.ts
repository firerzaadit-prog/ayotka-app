import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { bankAccountCreateSchema } from "@/lib/validations/bank-account";

/** Tiket 6.2: rekening tujuan transfer, dikelola admin pusat, ditampilkan ke siswa saat checkout. */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const bankAccounts = await prisma.bankAccount.findMany({ orderBy: { namaBank: "asc" } });
  return NextResponse.json({ bankAccounts });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bankAccountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const bankAccount = await prisma.bankAccount.create({ data: parsed.data });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "bank_accounts",
    entitasId: bankAccount.id,
    after: bankAccount,
    ip: getClientIp(request),
  });

  return NextResponse.json({ bankAccount }, { status: 201 });
}
