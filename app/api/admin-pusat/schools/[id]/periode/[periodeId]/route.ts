import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { periodeUbahSchema } from "@/lib/validations/school-periode";
import { hitungKursiTerpakai } from "@/lib/students/create";
import { PeriodeTidakValidError, statusPeriode, ubahPeriode, type PerubahanPeriode } from "@/lib/billing/periode-sekolah";
import { selaraskanKreditSekolah } from "@/lib/billing/kredit-pribadi";
import { akhirHariWIB, startOfDayWIB } from "@/lib/utils/datetime";

type RouteParams = { params: Promise<{ id: string; periodeId: string }> };

/**
 * Ubah atau cabut satu periode. Mengubah tanggal/tenggang ikut menggeser batas kursi siswa yang sudah dibuat dari
 * periode ini; mencabut (dicabut: true) membatalkan periode dan mencabut kursinya (untuk salah input).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id: schoolId, periodeId } = await params;
  const lama = await prisma.periodeLangganan.findUnique({ where: { id: periodeId } });
  if (!lama || lama.schoolId !== schoolId) {
    return NextResponse.json({ error: "Periode tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = periodeUbahSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }
  const data = parsed.data;
  const now = new Date();

  const perubahan: PerubahanPeriode = {
    nama: data.nama,
    catatan: data.catatan,
    seatQuota: data.seatQuota,
    masaTenggangHari: data.masaTenggangHari,
    mulai: data.mulai ? startOfDayWIB(data.mulai) : undefined,
    berakhir: data.berakhir ? akhirHariWIB(data.berakhir) : undefined,
    dicabut: data.dicabut,
  };

  if (!data.dicabut) {
    // Kuota tidak boleh di bawah siswa terdaftar selama periode ini sedang berlaku (aktif/tenggang) setelah diubah.
    const hasil = {
      mulai: perubahan.mulai ?? lama.mulai,
      berakhir: perubahan.berakhir ?? lama.berakhir,
      masaTenggangHari: perubahan.masaTenggangHari ?? lama.masaTenggangHari,
      dicabutAt: null,
    };
    const status = statusPeriode(hasil, now);
    const kuotaBaru = perubahan.seatQuota ?? lama.seatQuota;
    if (status === "aktif" || status === "tenggang") {
      const terdaftar = await hitungKursiTerpakai(schoolId);
      if (kuotaBaru < terdaftar) {
        return NextResponse.json(
          {
            error: `Kuota tidak bisa di bawah jumlah siswa yang sudah terdaftar (${terdaftar} siswa). Isi minimal ${terdaftar}, atau minta admin sekolah menghapus/menandai lulus siswa yang sudah tidak aktif.`,
          },
          { status: 400 },
        );
      }
    }
  }

  try {
    // Kredit pribadi siswa dihitung ulang terhadap periode yang berlaku SETELAH perubahan ini: periode dicabut atau
    // dipersingkat mengembalikan kredit yang tadinya ditunda; diperpanjang menundanya lebih jauh.
    const baru = await prisma.$transaction(
      async (tx) => {
        const hasil = await ubahPeriode(tx, periodeId, perubahan, now);
        await selaraskanKreditSekolah(tx, schoolId, now);
        return hasil;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
    await logAudit({
      userId: user.id,
      aksi: data.dicabut ? "delete" : "update",
      entitas: "school_periods",
      entitasId: periodeId,
      before: lama,
      after: baru,
      ip: getClientIp(request),
    });
    return NextResponse.json({ periode: baru });
  } catch (error) {
    if (error instanceof PeriodeTidakValidError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
