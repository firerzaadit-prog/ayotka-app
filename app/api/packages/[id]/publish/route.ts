import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";
import { validateBlueprintCompliance, formatBlueprintGapMessage } from "@/lib/blueprint/validate";
import { adalahPelanggaranUnik, GALAT_URUTAN_BERSAMAAN, periksaUrutanSeriPaket } from "@/lib/exam/seri-mandiri";

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

  // Try Out Mandiri milik pusat wajib punya urutan seri sebelum terbit (permintaan user, 5 Okt 2026) - paket lama yang
  // masih kosong harus diisi lewat Edit paket dulu. Sekalian memastikan nomornya tidak kembar dengan paket lain.
  const periksaUrutan = await periksaUrutanSeriPaket({
    subjectId: pkg.subjectId,
    jenjang: pkg.jenjang,
    kategori: pkg.kategori,
    ownerType: pkg.ownerType,
    urutanSeri: pkg.urutanSeri,
    excludePackageId: pkg.id,
  });
  if (!periksaUrutan.ok) {
    return NextResponse.json(
      {
        error:
          periksaUrutan.code === "URUTAN_SERI_WAJIB"
            ? "Urutan seri belum diisi. Isi dulu lewat tombol Edit paket sebelum menerbitkan Try Out Mandiri ini."
            : periksaUrutan.error,
        code: periksaUrutan.code,
      },
      { status: periksaUrutan.status },
    );
  }

  if (pkg.blueprint) {
    const result = validateBlueprintCompliance(
      pkg.blueprint.items.map((item) => ({
        kompetensiId: item.kompetensiId,
        kompetensiKode: item.kompetensi.deskripsi,
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
  let updated;
  try {
    updated = await prisma.package.update({
      where: { id },
      data: { status: "published", publishedAt: new Date() },
    });
  } catch (error) {
    // Paket diarsipkan lalu diterbitkan lagi sementara nomornya sudah dipakai paket lain: indeks unik menolaknya.
    if (adalahPelanggaranUnik(error)) return NextResponse.json(GALAT_URUTAN_BERSAMAAN, { status: 409 });
    throw error;
  }

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
