import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/** Tiket 3.3: autocomplete asal sekolah untuk Jalur B, berbasis nama/NPSN. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ schools: [] });
  }

  const schools = await prisma.school.findMany({
    where: {
      status: { not: "pending_verifikasi" },
      OR: [{ nama: { contains: q, mode: "insensitive" } }, { npsn: { contains: q } }],
    },
    select: { id: true, nama: true, npsn: true, jenjang: true },
    orderBy: { nama: "asc" },
    take: 10,
  });

  return NextResponse.json({ schools });
}
