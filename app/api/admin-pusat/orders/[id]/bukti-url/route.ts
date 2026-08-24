import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getBuktiTransferSignedUrl } from "@/lib/supabase/bukti-transfer";

type RouteParams = { params: Promise<{ id: string }> };

/** Tiket 6.4: bukti transfer di bucket private - admin lihat lewat signed URL berumur pendek, dibuat sesuai permintaan. */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, select: { buktiTransferUrl: true } });
  if (!order?.buktiTransferUrl) {
    return NextResponse.json({ error: "Bukti transfer tidak ditemukan." }, { status: 404 });
  }

  const url = await getBuktiTransferSignedUrl(order.buktiTransferUrl);
  if (!url) {
    return NextResponse.json({ error: "Gagal membuat tautan bukti transfer." }, { status: 500 });
  }

  return NextResponse.json({ url });
}
