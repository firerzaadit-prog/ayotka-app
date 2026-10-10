import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { assertOwnsPackage } from "@/lib/packages/scope";
import { PESAN_NASIONAL_ADMIN_PUSAT } from "@/lib/exam/paket-tersedia";
import { adaWaktuTidakValid, packageCreateSchema, toNullableDate, toNullableInt } from "@/lib/validations/question";
import { adalahPelanggaranUnik, GALAT_URUTAN_BERSAMAAN, periksaUrutanSeriPaket } from "@/lib/exam/seri-mandiri";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
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
      subject: true,
      visibility: { include: { school: { select: { id: true, nama: true } } } },
      blueprint: { include: { items: { include: { kompetensi: true } } } },
      questions: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          stimulus: true,
          kompetensi: { include: { elemen: true } },
          indikatorResmi: true,
          options: { orderBy: { urutan: "asc" } },
          _count: { select: { attemptAnswers: true } },
        },
      },
    },
  });

  return NextResponse.json({ package: pkg });
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const body = await request.json().catch(() => null);
  const parsed = packageCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const before = await prisma.package.findUnique({ where: { id } });
  const {
    blueprintId,
    visibilityMode,
    visibilitySchoolIds,
    visibilityEntries,
    bukaMulai,
    bukaSelesai,
    urutanSeri,
    ...rest
  } = parsed.data;

  // Try Out Nasional hanya dibuat dan dijalankan admin pusat: admin sekolah tidak boleh mengubah paket menjadi nasional.
  if (rest.kategori === "nasional" && user.role !== "admin_pusat") {
    return NextResponse.json({ error: PESAN_NASIONAL_ADMIN_PUSAT, code: "NASIONAL_ADMIN_PUSAT" }, { status: 403 });
  }

  const bukaMulaiDate = toNullableDate(bukaMulai);
  const bukaSelesaiDate = toNullableDate(bukaSelesai);
  if (adaWaktuTidakValid(bukaMulaiDate, bukaSelesaiDate)) {
    return NextResponse.json({ error: "Format waktu buka/tutup tidak valid." }, { status: 400 });
  }
  // Field yang tidak dikirim (undefined) berarti "tidak diubah" - pakai nilai
  // lama untuk validasi urutan supaya PATCH sebagian (cuma kirim salah satu
  // dari bukaMulai/bukaSelesai) tetap tervalidasi terhadap nilai tersimpan.
  const effectiveBukaMulai = bukaMulaiDate !== undefined ? bukaMulaiDate : (before?.bukaMulai ?? null);
  const effectiveBukaSelesai = bukaSelesaiDate !== undefined ? bukaSelesaiDate : (before?.bukaSelesai ?? null);
  if (effectiveBukaMulai && effectiveBukaSelesai && effectiveBukaSelesai <= effectiveBukaMulai) {
    return NextResponse.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
  }

  // Urutan seri cuma berlaku untuk kategori "mandiri" (permintaan user, 30 Sep
  // 2026) - kalau kategori (baru atau lama) "nasional", selalu dikosongkan
  // meski tidak diminta, supaya tidak ada sisa urutan yang lupa dibersihkan
  // saat kategori paket diganti. Lihat lib/exam/seri-mandiri.ts.
  const effectiveKategori = rest.kategori !== undefined ? rest.kategori : before?.kategori;
  const urutanSeriValue = effectiveKategori === "nasional" ? null : toNullableInt(urutanSeri);

  // Sejak 5 Okt 2026: Try Out Mandiri milik pusat WAJIB punya urutan seri, dan urutan tidak boleh kembar dalam satu
  // mapel. Diperiksa terhadap keadaan AKHIR paket (nilai baru, atau nilai tersimpan kalau tidak dikirim), jadi
  // paket lama yang belum punya urutan harus diisi dulu begitu diedit. Paket yang sudah diarsipkan dilewati.
  if (before && before.status !== "archived") {
    const periksaUrutan = await periksaUrutanSeriPaket({
      subjectId: rest.subjectId !== undefined ? rest.subjectId : before.subjectId,
      jenjang: rest.jenjang !== undefined ? rest.jenjang : before.jenjang,
      kategori: effectiveKategori,
      ownerType: before.ownerType,
      urutanSeri: urutanSeriValue !== undefined ? urutanSeriValue : before.urutanSeri,
      excludePackageId: id,
    });
    if (!periksaUrutan.ok) {
      return NextResponse.json({ error: periksaUrutan.error, code: periksaUrutan.code }, { status: periksaUrutan.status });
    }
  }

  // Distribusi lintas sekolah (visibility) cuma konsep milik paket pusat
  // (Tiket 2.8) - field ini diabaikan diam-diam kalau tetap dikirim
  // admin_sekolah, sama seperti visibility/route.ts (assertOwnedByPusat).
  const isPusat = user.role === "admin_pusat";
  let visibilityUpdate: Prisma.PackageUpdateInput["visibility"] = undefined;

  if (isPusat && visibilityEntries && visibilityEntries.length > 0) {
    // Mode dual-target: gunakan entries langsung (sekolah + mandiri sekaligus)
    visibilityUpdate = {
      deleteMany: {},
      create: visibilityEntries.map((e) => ({
        targetType: e.targetType,
        ...(e.schoolId ? { schoolId: e.schoolId } : {}),
      })),
    };
  } else if (isPusat && visibilityMode) {
    if (visibilityMode === "privat") {
      visibilityUpdate = { deleteMany: {} };
    } else if (visibilityMode === "semua" || visibilityMode === "publik") {
      visibilityUpdate = {
        deleteMany: {},
        create: [{ targetType: visibilityMode }],
      };
    } else if (visibilityMode === "sekolah" && visibilitySchoolIds) {
      visibilityUpdate = {
        deleteMany: {},
        create: visibilitySchoolIds.map((sid: string) => ({ targetType: "sekolah" as const, schoolId: sid })),
      };
    }
  }

  let pkg;
  try {
    pkg = await prisma.package.update({
      where: { id },
      data: {
        ...rest,
        ...(blueprintId !== undefined
          ? { blueprintId: blueprintId.length > 0 ? blueprintId : null }
          : {}),
        ...(bukaMulaiDate !== undefined ? { bukaMulai: bukaMulaiDate } : {}),
        ...(bukaSelesaiDate !== undefined ? { bukaSelesai: bukaSelesaiDate } : {}),
        ...(urutanSeriValue !== undefined ? { urutanSeri: urutanSeriValue } : {}),
        ...(visibilityUpdate ? { visibility: visibilityUpdate } : {}),
      },
    });
  } catch (error) {
    // Dua admin menyimpan nomor yang sama pada saat bersamaan: indeks unik menolak yang kedua.
    if (adalahPelanggaranUnik(error)) return NextResponse.json(GALAT_URUTAN_BERSAMAAN, { status: 409 });
    throw error;
  }

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "packages",
    entitasId: id,
    before,
    after: pkg,
    ip: getClientIp(request),
  });

  return NextResponse.json({ package: pkg });
}

/**
 * Tiket 2.9 (Bagian 7.2 brief): paket tidak boleh dihapus permanen, hanya
 * diarsipkan - dipakai status "archived" yang sudah ada di enum
 * PackageStatus, bukan kolom baru. Berlaku sama baik paket sudah punya
 * soal/attempt maupun masih kosong, supaya perilakunya konsisten &
 * riwayat tidak pernah hilang tanpa sengaja.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
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

  const before = await prisma.package.findUnique({ where: { id } });
  const pkg = await prisma.package.update({ where: { id }, data: { status: "archived" } });

  await logAudit({
    userId: user.id,
    aksi: "delete",
    entitas: "packages",
    entitasId: id,
    before,
    after: pkg,
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
