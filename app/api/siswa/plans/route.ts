import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/** Tiket 6.3: paket langganan (target siswa) untuk dipilih di halaman checkout. */
export async function GET() {
  try {
    await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const plans = await prisma.plan.findMany({
    where: { target: "siswa" },
    orderBy: { harga: "asc" },
  });

  return NextResponse.json({ plans });
}
