import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { servicePackageCreateSchema } from "@/lib/validations/service-package";

/**
 * Bagian 7.3 brief: paket layanan TKA — admin pusat bisa buat banyak paket
 * berbeda (nama, harga/mapel, jumlah TryOut/mapel). Siswa mandiri memilih
 * paket saat checkout.
 */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const packages = await prisma.servicePackage.findMany({
    orderBy: [{ isActive: "desc" }, { hargaPerMapel: "asc" }],
  });
  return NextResponse.json({ packages });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = servicePackageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { deskripsi, isActive, ...rest } = parsed.data;
  const pkg = await prisma.servicePackage.create({
    data: {
      ...rest,
      deskripsi: deskripsi || null,
      isActive: isActive ?? true,
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "service_packages",
    entitasId: pkg.id,
    after: pkg,
    ip: getClientIp(request),
  });

  return NextResponse.json({ package: pkg }, { status: 201 });
}
