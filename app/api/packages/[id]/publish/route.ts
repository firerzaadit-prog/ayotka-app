import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";
import { validateBlueprintCompliance, formatBlueprintGapMessage } from "@/lib/blueprint/validate";

type RouteParams = { params: Promise<{ id: string }> };

/** Tiket 2.7: tombol Publish - diblokir kalau komposisi paket belum sesuai kisi-kisi. */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  if (!(await assertOwnsPackage(user, id))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  const pkg = await prisma.package.findUnique({
    where: { id },
    include: {
      blueprint: { include: { items: { include: { kompetensi: true } } } },
      questions: { where: { deletedAt: null }, select: { kompetensiId: true, tingkatKesulitan: true, format: true } },
    },
  });
  if (!pkg) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }

  if (pkg.blueprint) {
    const result = validateBlueprintCompliance(
      pkg.blueprint.items.map((item) => ({
        kompetensiId: item.kompetensiId,
        kompetensiKode: item.kompetensi.kode,
        tingkatKesulitan: item.tingkatKesulitan,
        formatSoal: item.formatSoal,
        jumlahSoal: item.jumlahSoal,
      })),
      pkg.questions,
    );

    if (!result.compliant) {
      return NextResponse.json(
        {
          error: `Komposisi paket belum sesuai kisi-kisi: ${formatBlueprintGapMessage(result.gaps)}.`,
          gaps: result.gaps,
        },
        { status: 422 },
      );
    }
  }

  const before = pkg;
  const updated = await prisma.package.update({
    where: { id },
    data: { status: "published", publishedAt: new Date() },
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "packages",
    entitasId: id,
    before,
    after: updated,
    ip: getClientIp(request),
  });

  return NextResponse.json({ package: updated });
}
