import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { muatRekapPenugasan } from "@/lib/exam/rekap-bersama-data";
import { buatRekapExcel, namaBerkasRekap } from "@/lib/exam/rekap-bersama-excel";

type RouteParams = { params: Promise<{ id: string }> };

/** Unduh rekap hasil Try Out Bersama sebagai Excel - datanya sama persis dengan tampilan rekap. */
export async function GET(_request: Request, { params }: RouteParams) {
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

  const { id } = await params;
  const rekap = await muatRekapPenugasan(schoolId, id);
  if (!rekap) {
    return NextResponse.json({ error: "Penugasan tidak ditemukan." }, { status: 404 });
  }

  const sekarang = new Date();
  const berkas = await buatRekapExcel(
    {
      sekolah: rekap.penugasan.sekolahNama,
      paket: rekap.penugasan.paketNama,
      mapel: rekap.penugasan.mapel,
      mulai: rekap.penugasan.mulai,
      selesai: rekap.penugasan.selesai,
      dibuatPada: sekarang,
    },
    rekap.baris,
    rekap.statistik,
  );

  return new NextResponse(new Uint8Array(berkas), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkasRekap(rekap.penugasan.paketNama, sekarang)}"`,
      "Cache-Control": "no-store",
    },
  });
}
