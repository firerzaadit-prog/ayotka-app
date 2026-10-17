import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/** Isian satu invoice yang pernah diterbitkan, untuk dipakai lagi sebagai dasar invoice berikutnya (formulir memuatnya). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }
  const baris = await prisma.invoiceBebas.findUnique({ where: { id }, select: { id: true, nomorInvoice: true, data: true } });
  if (!baris) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });

  return NextResponse.json({ id: baris.id, nomorInvoice: baris.nomorInvoice, data: baris.data }, { headers: { "Cache-Control": "no-store" } });
}
