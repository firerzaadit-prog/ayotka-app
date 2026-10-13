import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { bacaRentangTanggal } from "@/lib/analytics/rentang";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveSchoolId } from "@/lib/schools/scope";
import { bacaFilterJenis, type FilterJenis } from "@/lib/hasil-tryout/jenis";
import {
  URUTAN_PAKET_TERSEDIA,
  URUTAN_RAPOR_TERSEDIA,
  type SaringHasil,
  type UrutanPaket,
  type UrutanRapor,
} from "@/lib/hasil-tryout/susun";

/**
 * Otorisasi dan pembacaan parameter bersama rute laporan hasil try out admin sekolah (rapor, peringkat, paket, dan
 * unduhannya). Sekolah SELALU ditentukan oleh sesi (resolveSchoolId tanpa parameter): admin sekolah memakai sekolahnya
 * sendiri, admin pusat memakai sekolah yang sedang dikelolanya (mode "Kelola Sekolah"); ?schoolId= tidak pernah dipakai.
 */
export type AksesLaporan = { galat: NextResponse } | { userId: string; schoolId: string; url: URL };

export async function bacaAksesLaporan(request: Request, opsi: { kunci: string; batasPerMenit: number }): Promise<AksesLaporan> {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return { galat: NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 }) };
  }
  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return { galat: NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 }) };
  }
  // Tiap permintaan membaca seluruh hasil sekolah lalu menghitungnya, jadi lajunya dibatasi per pengguna.
  if (!checkRateLimit(`${opsi.kunci}:${user.id}`, opsi.batasPerMenit, 60_000)) {
    return { galat: NextResponse.json({ error: "Terlalu banyak permintaan, coba lagi sebentar lagi." }, { status: 429 }) };
  }
  return { userId: user.id, schoolId, url: new URL(request.url) };
}

const uuid = z.string().uuid();
const galat400 = (pesan: string) => ({ galat: NextResponse.json({ error: pesan }, { status: 400 }) });

export type FilterLaporan = {
  jenis: FilterJenis;
  mapelId: string | null;
  paketId: string | null;
  dari: Date | null;
  sampai: Date | null;
  alumni: "ikut" | "tanpa";
  cari: string | null;
};

export const MAKS_PANJANG_CARI = 100;

/** ?jenis= ?mapel= ?paket= ?dari= ?sampai= ?alumni= ?cari= -> filter yang sudah divalidasi, atau jawaban 400. */
export function bacaFilterLaporan(url: URL, bawaanAlumni: "ikut" | "tanpa"): { filter: FilterLaporan } | { galat: NextResponse } {
  const jenis = bacaFilterJenis(url.searchParams.get("jenis"));
  if (!jenis) return galat400("Jenis try out tidak dikenal.");

  const mapel = url.searchParams.get("mapel") || null;
  if (mapel && !uuid.safeParse(mapel).success) return galat400("Mata pelajaran tidak valid.");
  const paket = url.searchParams.get("paket") || null;
  if (paket && !uuid.safeParse(paket).success) return galat400("Paket tidak valid.");

  const alumniMentah = url.searchParams.get("alumni");
  if (alumniMentah && alumniMentah !== "ikut" && alumniMentah !== "tanpa") return galat400("Pilihan alumni tidak dikenal.");
  const alumni = (alumniMentah as "ikut" | "tanpa" | null) ?? bawaanAlumni;

  const rentang = bacaRentangTanggal(url);
  if ("galat" in rentang) return { galat: rentang.galat };

  const cari = (url.searchParams.get("cari") ?? "").trim().slice(0, MAKS_PANJANG_CARI) || null;

  return {
    filter: { jenis, mapelId: mapel, paketId: paket, dari: rentang.rentang?.dari ?? null, sampai: rentang.rentang?.sampai ?? null, alumni, cari },
  };
}

export const kePenyaring = (f: FilterLaporan): SaringHasil => ({
  jenis: f.jenis,
  mapelId: f.mapelId,
  paketId: f.paketId,
  dari: f.dari,
  sampai: f.sampai,
  alumni: f.alumni,
  cari: f.cari,
});

/** Bilangan bulat dari parameter alamat: kosong -> bawaan; bukan bilangan bulat atau di luar rentang -> null. */
function bacaBulat(nilai: string | null, bawaan: number, min: number, maks: number): number | null {
  if (nilai === null || nilai === "") return bawaan;
  if (!/^\d{1,6}$/.test(nilai)) return null;
  const n = Number(nilai);
  return n >= min && n <= maks ? n : null;
}

export const UKURAN_HALAMAN_TERSEDIA = [10, 20, 50, 100] as const;

export function bacaHalaman(url: URL): { halaman: number; ukuran: number } | { galat: NextResponse } {
  const halaman = bacaBulat(url.searchParams.get("halaman"), 1, 1, 100_000);
  if (halaman === null) return galat400("Nomor halaman tidak valid.");
  const ukuran = bacaBulat(url.searchParams.get("ukuran"), 20, 1, 100);
  if (ukuran === null || !(UKURAN_HALAMAN_TERSEDIA as readonly number[]).includes(ukuran)) return galat400("Jumlah baris per halaman tidak valid.");
  return { halaman, ukuran };
}

export type HasilBaca<T> = { nilai: T } | { galat: NextResponse };

export function bacaUrutanRapor(url: URL): HasilBaca<UrutanRapor> {
  const nilai = url.searchParams.get("urut");
  if (!nilai) return { nilai: "terbaru" };
  if (!(URUTAN_RAPOR_TERSEDIA as readonly string[]).includes(nilai)) return galat400("Urutan tidak dikenal.");
  return { nilai: nilai as UrutanRapor };
}

export function bacaUrutanPaket(url: URL): HasilBaca<UrutanPaket> {
  const nilai = url.searchParams.get("urut");
  if (!nilai) return { nilai: "terbanyak" };
  if (!(URUTAN_PAKET_TERSEDIA as readonly string[]).includes(nilai)) return galat400("Urutan tidak dikenal.");
  return { nilai: nilai as UrutanPaket };
}

export function bacaMinimalTryOut(url: URL): HasilBaca<number> {
  const n = bacaBulat(url.searchParams.get("minimal"), 1, 1, 50);
  if (n === null) return galat400("Jumlah minimal try out tidak valid.");
  return { nilai: n };
}
