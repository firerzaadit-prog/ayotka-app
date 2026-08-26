import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getBuktiTransferSignedUrl } from "@/lib/supabase/bukti-transfer";

type RouteParams = { params: Promise<{ id: string }> };

/** Bagian 7.3 brief: bukti transfer order try out mapel, sama seperti order langganan - signed URL berumur pendek. */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.subjectTryOutOrder.findUnique({
    where: { id },
    select: { buktiTransferUrl: true },
  });
  if (!order?.buktiTransferUrl) {
    return NextResponse.json({ error: "Bukti transfer tidak ditemukan." }, { status: 404 });
  }

  const url = await getBuktiTransferSignedUrl(order.buktiTransferUrl);
  if (!url) {
    return NextResponse.json({ error: "Gagal membuat tautan bukti transfer." }, { status: 500 });
  }

  return NextResponse.json({ url });
}
