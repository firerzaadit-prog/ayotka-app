import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/** Tiket 6.3: rekening tujuan aktif untuk ditampilkan di halaman checkout siswa mandiri. */
export async function GET() {
  try {
    await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { isActive: true },
    orderBy: { namaBank: "asc" },
    select: { id: true, namaBank: true, nomorRekening: true, atasNama: true },
  });

  return NextResponse.json({ bankAccounts });
}
