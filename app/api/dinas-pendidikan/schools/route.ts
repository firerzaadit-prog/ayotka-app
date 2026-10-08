import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { bacaCakupanDinas, bacaFilterWilayahDinas } from "@/lib/dinas/wilayah";
import { whereSekolahWilayah } from "@/lib/wilayah/cakupan";

/**
 * Daftar sekolah aktif utk dropdown filter di halaman Analitik Global dinas
 * pendidikan. Field SENGAJA minimal (id/nama/jenjang/status) - beda dari
 * /api/admin-pusat/schools yang menyertakan kodeSekolah (kode klaim
 * registrasi Jalur A siswa): dinas_pendidikan cuma perlu identitas sekolah
 * utk memfilter, tidak boleh bisa melihat kode klaim sekolah lain di luar
 * kewenangannya.
 *
 * Akun dinas hanya melihat sekolah di wilayah cakupannya (provinsi atau kota/kabupaten yang ditetapkan admin
 * pusat); dinas provinsi bisa mempersempit lewat ?kabupatenKota=. ?statusSekolah=negeri|swasta menyaring status
 * sekolah. Admin pusat melihat semua.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "dinas_pendidikan");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  // Dinas pendidikan: filter berdasarkan wilayah cakupan (gagal tertutup bila wilayahnya belum diatur)
  const cakupan = await bacaCakupanDinas(user);
  if ("galat" in cakupan) return cakupan.galat;
  const wilayahFilter = bacaFilterWilayahDinas(cakupan, new URL(request.url));
  if ("galat" in wilayahFilter) return wilayahFilter.galat;

  const schools = await prisma.school.findMany({
    where: {
      status: "aktif",
      ...whereSekolahWilayah(wilayahFilter),
    },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, jenjang: true, status: true, provinsi: true, kabupatenKota: true, statusSekolah: true },
  });

  return NextResponse.json({ schools });
}

