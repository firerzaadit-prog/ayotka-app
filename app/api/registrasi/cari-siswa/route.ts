import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import { findActiveSchoolByCode } from "@/lib/schools/lookup";
import { cariSiswaSchema } from "@/lib/validations/registrasi";

/**
 * Tiket 3.2 - KRITIS untuk privasi (Bagian 3.1 & 10 brief, temuan #1):
 * endpoint ini SELALU memvalidasi ulang kodeSekolah dari database sebelum
 * mencari nama, dan menolak kalau tidak valid/tidak aktif - jangan pernah
 * dihapus/dilonggarkan, ini satu-satunya penghalang supaya daftar nama
 * siswa (data anak di bawah umur) tidak bisa dipanen tanpa kode sekolah.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request) ?? "unknown";
  if (!checkRateLimit(`cari-siswa:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Terlalu banyak percobaan, coba lagi sebentar lagi." }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsed = cariSiswaSchema.safeParse({
    kodeSekolah: url.searchParams.get("kodeSekolah"),
    nama: url.searchParams.get("nama"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const school = await findActiveSchoolByCode(parsed.data.kodeSekolah.toUpperCase());
  if (!school) {
    return NextResponse.json({ error: "Kode sekolah tidak valid." }, { status: 403 });
  }

  const students = await prisma.student.findMany({
    where: {
      schoolId: school.id,
      claimStatus: "belum_klaim",
      deletedAt: null,
      nama: { contains: parsed.data.nama, mode: "insensitive" },
    },
    select: { id: true, nama: true },
    orderBy: { nama: "asc" },
    take: 10,
  });

  return NextResponse.json({ students });
}
