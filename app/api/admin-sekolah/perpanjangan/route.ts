import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { kirimEmail } from "@/lib/email/kirim";
import { kirimNotifikasiPermintaan } from "@/lib/billing/notifikasi-permintaan";
import { resolveSchoolId } from "@/lib/schools/scope";
import { hitungKursiTerpakai } from "@/lib/students/create";
import { permintaanBuatSchema } from "@/lib/validations/school-periode";
import { ambilPeriodeSekolah, geserTanggal } from "@/lib/billing/periode-sekolah";
import {
  ajukanPermintaan,
  ambilPermintaanMenunggu,
  ambilPermintaanTerakhirDiproses,
  PermintaanTidakValidError,
} from "@/lib/billing/permintaan-perpanjangan";
import { akhirHariWIB, startOfDayWIB, tanggalWIB } from "@/lib/utils/datetime";

/**
 * Ajukan perpanjangan langganan dari halaman Periode Baru. Admin sekolah hanya MENGAJUKAN; admin pusat yang
 * membuat periode barunya setelah pembayaran dikonfirmasi di luar sistem (lihat lib/billing/permintaan-perpanjangan.ts).
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const [menunggu, terakhirDiproses, periode, siswaAktif] = await Promise.all([
    ambilPermintaanMenunggu(prisma, schoolId),
    ambilPermintaanTerakhirDiproses(prisma, schoolId),
    ambilPeriodeSekolah(prisma, schoolId),
    hitungKursiTerpakai(schoolId),
  ]);

  // Usulan tanggal mulai: sehari setelah periode terakhir berakhir (berkesinambungan), tetapi tidak sebelum hari ini.
  const hariIni = tanggalWIB();
  const terakhir = periode.reduce<Date | null>((acuan, p) => (!acuan || p.berakhir > acuan ? p.berakhir : acuan), null);
  const sesudahTerakhir = terakhir ? geserTanggal(tanggalWIB(terakhir), 1) : hariIni;
  const mulaiDefault = sesudahTerakhir > hariIni ? sesudahTerakhir : hariIni;

  return NextResponse.json({
    menunggu,
    terakhirDiproses,
    siswaAktif,
    mulaiDefault,
    kuotaTerakhir: periode.length > 0 ? periode[periode.length - 1]!.seatQuota : null,
  });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }
  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = permintaanBuatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }

  try {
    const permintaan = await ajukanPermintaan(prisma, {
      schoolId,
      diajukanOlehId: user.id,
      kuotaDiminta: parsed.data.kuotaDiminta,
      mulai: startOfDayWIB(parsed.data.mulai),
      berakhir: akhirHariWIB(parsed.data.berakhir),
      catatan: parsed.data.catatan,
    });
    await logAudit({
      userId: user.id,
      aksi: "create",
      entitas: "school_renewal_requests",
      entitasId: permintaan.id,
      after: permintaan,
      ip: getClientIp(request),
    });

    // Beri tahu admin pusat lewat email (hanya bila pengajunya admin sekolah; admin pusat yang mengajukan lewat mode
    // "Kelola sekolah" sudah tahu). Di latar belakang lewat after() supaya admin sekolah tidak menunggu pengiriman
    // dan kegagalan email tidak mengubah hasil pengajuan - fungsi ini tidak pernah melempar galat.
    if (user.role === "admin_sekolah") {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/+$/, "");
      try {
        after(() =>
          kirimNotifikasiPermintaan(
            {
              db: prisma,
              appUrl,
              kirim: async (email) => {
                const r = await kirimEmail(email);
                return r.ok ? { ok: true } : { ok: false, error: r.error };
              },
            },
            permintaan.id,
          ),
        );
      } catch (error) {
        // Pengajuan sudah tersimpan dan diaudit: gagal menjadwalkan email tidak boleh berubah menjadi galat 500
        // (admin sekolah akan mengulang dan mendapat 409 "sudah ada permintaan").
        console.error("[perpanjangan] gagal menjadwalkan pemberitahuan email ke admin pusat:", error);
      }
    }
    return NextResponse.json({ permintaan }, { status: 201 });
  } catch (error) {
    if (error instanceof PermintaanTidakValidError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
