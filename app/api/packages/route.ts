import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { getOwnerScope } from "@/lib/packages/scope";
import { PESAN_NASIONAL_ADMIN_PUSAT } from "@/lib/exam/paket-tersedia";
import { adaWaktuTidakValid, packageCreateSchema, toNullableDate, toNullableInt } from "@/lib/validations/question";
import {
  adalahPelanggaranUnik,
  GALAT_URUTAN_BERSAMAAN,
  hitungSiswaSelesaiPerPaket,
  periksaUrutanSeriPaket,
} from "@/lib/exam/seri-mandiri";

export async function GET() {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const scope = await getOwnerScope(user);
  if (!scope) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const packages = await prisma.package.findMany({
    where: { ownerType: scope.ownerType, ownerId: scope.ownerId, status: { not: "archived" } },
    orderBy: [
      { jenjang: "asc" },
      { subject: { nama: "asc" } },
      { urutanSeri: { sort: "asc", nulls: "last" } },
      { nama: "asc" },
    ],
    include: {
      subject: true,
      _count: {
        select: {
          questions: { where: { deletedAt: null } },
          attempts: { where: { status: { in: ["selesai", "kedaluwarsa"] } } },
        },
      },
    },
  });

  // Jumlah siswa yang sudah menyelesaikan tiap paket berseri - untuk panel posisi urutan seri di halaman admin.
  const idBerseri = packages.filter((p) => p.kategori === "mandiri" && p.urutanSeri != null).map((p) => p.id);
  const siswaSelesai = await hitungSiswaSelesaiPerPaket(idBerseri);

  return NextResponse.json({ packages, siswaSelesai });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const scope = await getOwnerScope(user);
  if (!scope) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = packageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { blueprintId, visibilityMode, visibilitySchoolIds, bukaMulai, bukaSelesai, urutanSeri, ...rest } =
    parsed.data;

  // Try Out Nasional hanya dibuat dan dijalankan admin pusat (menu Bank Soal sekolah tidak menawarkannya, dan ini
  // menutup jalur lewat permintaan langsung ke API).
  if (rest.kategori === "nasional" && user.role !== "admin_pusat") {
    return NextResponse.json({ error: PESAN_NASIONAL_ADMIN_PUSAT, code: "NASIONAL_ADMIN_PUSAT" }, { status: 403 });
  }

  const bukaMulaiDate = toNullableDate(bukaMulai);
  const bukaSelesaiDate = toNullableDate(bukaSelesai);
  if (adaWaktuTidakValid(bukaMulaiDate, bukaSelesaiDate)) {
    return NextResponse.json({ error: "Format waktu buka/tutup tidak valid." }, { status: 400 });
  }
  if (bukaMulaiDate && bukaSelesaiDate && bukaSelesaiDate <= bukaMulaiDate) {
    return NextResponse.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
  }

  // Urutan seri cuma berlaku untuk kategori "mandiri" (permintaan user, 30
  // Sep 2026) - diabaikan diam-diam untuk "nasional" (lihat lib/exam/seri-mandiri.ts).
  // Sejak 5 Okt 2026 Try Out Mandiri milik pusat WAJIB punya urutan, dan urutan tidak boleh kembar
  // dalam satu mapel (periksaUrutanSeriPaket).
  const kategori = rest.kategori ?? "mandiri";
  const urutanSeriValue = kategori === "nasional" ? null : (toNullableInt(urutanSeri) ?? null);
  const periksaUrutan = await periksaUrutanSeriPaket({
    subjectId: rest.subjectId,
    jenjang: rest.jenjang,
    kategori,
    ownerType: scope.ownerType,
    urutanSeri: urutanSeriValue,
  });
  if (!periksaUrutan.ok) {
    return NextResponse.json({ error: periksaUrutan.error, code: periksaUrutan.code }, { status: periksaUrutan.status });
  }

  // Distribusi lintas sekolah (visibility) cuma konsep milik paket pusat
  // (Tiket 2.8) - paket sekolah tidak punya ini, field ini diabaikan diam-diam
  // kalau tetap dikirim admin_sekolah (lihat visibility/route.ts assertOwnedByPusat).
  let visibilityCreate: Prisma.PackageCreateInput["visibility"] = undefined;
  if (scope.ownerType === "pusat" && visibilityMode && visibilityMode !== "privat") {
    if (visibilityMode === "sekolah" && visibilitySchoolIds) {
      visibilityCreate = {
        create: visibilitySchoolIds.map((id: string) => ({ targetType: "sekolah" as const, schoolId: id })),
      };
    } else {
      visibilityCreate = { create: [{ targetType: visibilityMode }] };
    }
  }

  let pkg;
  try {
    pkg = await prisma.package.create({
      data: {
        ...rest,
        ...scope,
        blueprintId: blueprintId && blueprintId.length > 0 ? blueprintId : null,
        bukaMulai: bukaMulaiDate ?? null,
        bukaSelesai: bukaSelesaiDate ?? null,
        urutanSeri: urutanSeriValue,
        ...(visibilityCreate ? { visibility: visibilityCreate } : {}),
      },
    });
  } catch (error) {
    // Dua admin menyimpan nomor yang sama pada saat bersamaan: indeks unik menolak yang kedua.
    if (adalahPelanggaranUnik(error)) return NextResponse.json(GALAT_URUTAN_BERSAMAAN, { status: 409 });
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "packages",
    entitasId: pkg.id,
    after: pkg,
    ip: getClientIp(request),
  });

  return NextResponse.json({ package: pkg }, { status: 201 });
}
