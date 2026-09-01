import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";

/** Tiket 3.3: autocomplete asal sekolah untuk Jalur B, berbasis nama/NPSN. */
export async function GET(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  if (!checkRateLimit(`cari-sekolah:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar lagi." }, { status: 429 });
  }

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
