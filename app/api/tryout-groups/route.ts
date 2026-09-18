import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { tryOutGroupCreateSchema } from "@/lib/validations/question";
import { toNullableDate } from "@/lib/validations/question";

/**
 * Bagian 8/10 (permintaan user, "paket soal yang banyak, diacak"): admin
 * pusat saja untuk sekarang (fitur ini lahir dari kebutuhan try out
 * nasional, bukan per sekolah) - beda dari /api/packages yang juga dipakai
 * admin_sekolah.
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const groups = await prisma.tryOutGroup.findMany({
    where: { ownerType: "pusat", ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { subject: true, _count: { select: { packages: true } } },
  });

  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = tryOutGroupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { visibilityMode, visibilitySchoolIds, bukaMulai, bukaSelesai, ...rest } = parsed.data;

  const bukaMulaiDate = toNullableDate(bukaMulai);
  const bukaSelesaiDate = toNullableDate(bukaSelesai);
  if (bukaMulaiDate && bukaSelesaiDate && bukaSelesaiDate <= bukaMulaiDate) {
    return NextResponse.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
  }

  let visibilityCreate: Prisma.TryOutGroupCreateInput["visibility"] = undefined;
  if (visibilityMode && visibilityMode !== "privat") {
    if (visibilityMode === "sekolah" && visibilitySchoolIds) {
      visibilityCreate = {
        create: visibilitySchoolIds.map((id: string) => ({ targetType: "sekolah" as const, schoolId: id })),
      };
    } else {
      visibilityCreate = { create: [{ targetType: visibilityMode }] };
    }
  }

  const group = await prisma.tryOutGroup.create({
    data: {
      ...rest,
      ownerType: "pusat",
      ownerId: user.id,
      bukaMulai: bukaMulaiDate ?? null,
      bukaSelesai: bukaSelesaiDate ?? null,
      ...(visibilityCreate ? { visibility: visibilityCreate } : {}),
    },
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "try_out_groups",
    entitasId: group.id,
    after: group,
    ip: getClientIp(request),
  });

  return NextResponse.json({ group }, { status: 201 });
}
