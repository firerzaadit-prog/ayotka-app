import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

/** Antrean permintaan perpanjangan yang menunggu (semua sekolah), terlama di atas - untuk dashboard dan daftar sekolah admin pusat. */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const permintaan = await prisma.permintaanPerpanjangan.findMany({
    where: { status: "menunggu" },
    orderBy: { createdAt: "asc" },
    include: { school: { select: { id: true, nama: true } } },
  });

  return NextResponse.json({
    permintaan: permintaan.map((p) => ({
      id: p.id,
      schoolId: p.schoolId,
      schoolNama: p.school.nama,
      kuotaDiminta: p.kuotaDiminta,
      mulaiDiminta: p.mulaiDiminta,
      berakhirDiminta: p.berakhirDiminta,
      catatan: p.catatan,
      createdAt: p.createdAt,
    })),
  });
}
