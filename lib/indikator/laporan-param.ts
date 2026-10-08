import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { bacaRentangPeriode } from "@/lib/analytics/rentang";
import type { RentangWaktu, FilterKategoriUjian } from "@/lib/analytics/sekolah";
import { bacaPermintaanFilterWilayah, gabungkanFilterWilayah, type FilterWilayah } from "@/lib/wilayah/cakupan";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveSchoolId } from "@/lib/schools/scope";
import { formatWIBDate } from "@/lib/utils/datetime";

export type HasilParamLaporan =
  | { galat: NextResponse }
  | {
      userId: string;
      schoolId: string;
      subjectId: string | null;
      rentang: RentangWaktu | null;
      periodeLabel: string;
      /** Cakupan pembanding pengguna AyoTKA dari ?provinsi=, ?kabupatenKota=, ?statusSekolah= (tanpa parameter = nasional). */
      pembanding: FilterWilayah;
      kategoriUjian?: FilterKategoriUjian;
    };

/**
 * Otorisasi + parameter bersama ketiga rute laporan indikator sekolah (JSON, PDF, Excel): hanya admin sekolah (atau admin pusat
 * yang sedang mengelola sebuah sekolah), sekolah SELALU dari sesi (tidak pernah dari parameter), ?subjectId= harus UUID, dan
 * ?periodeId= divalidasi milik sekolah itu oleh bacaRentangPeriode. Perhitungan laporan cukup berat, jadi dibatasi lajunya.
 */
export async function bacaParamLaporan(request: Request): Promise<HasilParamLaporan> {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return { galat: NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 }) };
  }
  const url = new URL(request.url);
  const schoolId = await resolveSchoolId(user, url.searchParams.get("schoolId"));
  if (!schoolId) {
    return { galat: NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 }) };
  }
  if (!checkRateLimit(`laporan-indikator:${user.id}`, 30, 60_000)) {
    return { galat: NextResponse.json({ error: "Terlalu banyak permintaan, coba lagi sebentar lagi." }, { status: 429 }) };
  }

  const subjectRaw = url.searchParams.get("subjectId");
  if (subjectRaw && !z.string().uuid().safeParse(subjectRaw).success) {
    return { galat: NextResponse.json({ error: "Mata pelajaran tidak valid." }, { status: 400 }) };
  }

  // Pembanding boleh dipilih bebas (nasional, provinsi, atau kota/kabupaten mana pun): yang keluar hanya angka gabungan
  // yang sudah lolos ambang jumlah sekolah (lib/indikator/pembanding.ts), tanpa identitas sekolah lain.
  const hasilPembanding = gabungkanFilterWilayah({ provinsi: null, kabupatenKota: null }, bacaPermintaanFilterWilayah(url.searchParams));
  if (!hasilPembanding.ok) {
    return { galat: NextResponse.json({ error: hasilPembanding.pesan }, { status: hasilPembanding.status }) };
  }

  const hasilRentang = await bacaRentangPeriode(url, schoolId);
  if ("galat" in hasilRentang) return { galat: hasilRentang.galat };

  let periodeLabel = "Semua waktu";
  const periodeId = url.searchParams.get("periodeId");
  if (periodeId) {
    const periode = await prisma.periodeLangganan.findFirst({ where: { id: periodeId, schoolId, dicabutAt: null }, select: { nama: true, mulai: true, berakhir: true } });
    if (periode) periodeLabel = `${periode.nama ?? "Periode langganan"} (${formatWIBDate(periode.mulai)} - ${formatWIBDate(periode.berakhir)})`;
  }

  return {
    userId: user.id,
    schoolId,
    subjectId: subjectRaw || null,
    rentang: hasilRentang.rentang,
    periodeLabel,
    pembanding: hasilPembanding.filter,
    kategoriUjian: (url.searchParams.get("kategoriUjian") as FilterKategoriUjian) || undefined,
  };
}

/** Potongan nama berkas yang aman: huruf kecil, angka, dan strip. */
export function slugBerkas(teks: string): string {
  return teks
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60) || "laporan";
}
