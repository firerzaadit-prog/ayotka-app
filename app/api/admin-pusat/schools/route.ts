import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { PeriodeLangganan } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { generateReadableCode, generateTempPassword } from "@/lib/utils/generate-code";
import { createAdminClient } from "@/lib/supabase/admin";
import { schoolCreateSchema } from "@/lib/validations/school";
import { buatPeriode, pilihPeriodeRujukan, segeraBerakhir, sisaHariWIB, statusPeriode } from "@/lib/billing/periode-sekolah";
import { akhirHariWIB, startOfDayWIB, tanggalWIB } from "@/lib/utils/datetime";

export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const schools = await prisma.school.findMany({
    orderBy: { nama: "asc" },
    include: { _count: { select: { schoolUsers: true, students: true } } },
  });

  // Kuota & masa berlaku yang ditampilkan dihitung SEGAR dari periode langganan, bukan dari kolom salinan
  // School.seatQuota/validUntil (kolom itu tidak berubah sendiri saat periode berikutnya mulai berlaku).
  const periode = schools.length
    ? await prisma.periodeLangganan.findMany({
        where: { schoolId: { in: schools.map((s) => s.id) }, dicabutAt: null },
      })
    : [];
  const periodePerSekolah = new Map<string, PeriodeLangganan[]>();
  for (const p of periode) periodePerSekolah.set(p.schoolId, [...(periodePerSekolah.get(p.schoolId) ?? []), p]);

  // Sekolah yang punya permintaan perpanjangan menunggu (untuk lencana di daftar).
  const menunggu = await prisma.permintaanPerpanjangan.findMany({
    where: { status: "menunggu" },
    select: { schoolId: true },
    distinct: ["schoolId"],
  });
  const adaPermintaan = new Set(menunggu.map((m) => m.schoolId));

  const now = new Date();
  return NextResponse.json({
    schools: schools.map((school) => {
      const rujukan = pilihPeriodeRujukan(periodePerSekolah.get(school.id) ?? [], now);
      return {
        ...school,
        seatQuota: rujukan?.seatQuota ?? null,
        validUntil: rujukan?.berakhir ?? null,
        statusLangganan: rujukan ? statusPeriode(rujukan, now) : "belum_aktif",
        /** Sisa hari kalender WIB sampai berakhir (0 = hari terakhir, negatif = lewat). */
        sisaHari: rujukan ? sisaHariWIB(rujukan.berakhir, now) : null,
        /** Periode aktif yang tinggal H-7 atau kurang. */
        segeraBerakhir: rujukan ? segeraBerakhir(rujukan, now) : false,
        adaPermintaan: adaPermintaan.has(school.id),
      };
    }),
  });
}

async function generateUniqueKodeSekolah(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReadableCode(6);
    const existing = await prisma.school.findUnique({ where: { kodeSekolah: code } });
    if (!existing) return code;
  }
  throw new Error("Gagal membuat kode sekolah unik, coba lagi.");
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schoolCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { npsn, alamat, seatQuota, validUntil, adminEmail, adminNama, ...rest } = parsed.data;

  // Kuota + tanggal berakhir (berpasangan, lihat schoolCreateSchema) membentuk periode langganan pertama. Tanggal
  // yang sudah lewat ditolak SEBELUM akun admin dibuat, supaya tidak ada akun yatim bila periodenya tidak sah.
  const periodeAwal =
    seatQuota != null && validUntil
      ? { seatQuota, mulai: startOfDayWIB(tanggalWIB()), berakhir: akhirHariWIB(validUntil) }
      : null;
  if (periodeAwal && periodeAwal.berakhir.getTime() < periodeAwal.mulai.getTime()) {
    return NextResponse.json({ error: "Masa berlaku tidak boleh sebelum hari ini." }, { status: 400 });
  }

  const kodeSekolah = await generateUniqueKodeSekolah();

  // Jika adminEmail diisi, pastikan email belum dipakai
  if (adminEmail) {
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) {
      return NextResponse.json(
        { error: `Email ${adminEmail} sudah digunakan oleh akun lain.` },
        { status: 409 },
      );
    }
  }

  // Akun admin sekolah dibuat DULU (kalau diminta): kalau gagal, sekolah tidak
  // ikut disimpan. Dulu sekolah tetap tersimpan tanpa admin dan responsnya tetap
  // 201, jadi admin pusat mengira akunnya sudah jadi.
  let adminAuth: { id: string; email: string; password: string } | null = null;
  if (adminEmail) {
    const tempPassword = generateTempPassword();
    const { data: authData, error: authError } = await createAdminClient().auth.admin.createUser({
      email: adminEmail,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role: "admin_sekolah" },
      user_metadata: { must_change_password: true, nama: adminNama || parsed.data.nama },
    });
    if (authError || !authData.user) {
      console.error("[admin-pusat/schools] gagal membuat akun admin sekolah:", authError);
      return NextResponse.json(
        { error: "Akun admin sekolah gagal dibuat, jadi sekolah belum disimpan. Periksa emailnya lalu coba lagi." },
        { status: 502 },
      );
    }
    adminAuth = { id: authData.user.id, email: adminEmail, password: tempPassword };
  }

  try {
    // Satu transaksi: sekolah + periode awal + baris akun admin tersimpan bersama atau tidak sama sekali.
    const school = await prisma.$transaction(async (tx) => {
      const created = await tx.school.create({
        data: {
          ...rest,
          npsn: npsn && npsn.length > 0 ? npsn : null,
          alamat: alamat && alamat.length > 0 ? alamat : null,
          kabupatenKota: rest.kabupatenKota && rest.kabupatenKota.length > 0 ? rest.kabupatenKota : null,
          kodeSekolah,
          status: "aktif",
        },
      });
      if (periodeAwal) {
        // buatPeriode juga mengisi kolom salinan School.seatQuota/validUntil.
        await buatPeriode(tx, {
          schoolId: created.id,
          nama: "Periode awal",
          mulai: periodeAwal.mulai,
          berakhir: periodeAwal.berakhir,
          seatQuota: periodeAwal.seatQuota,
          dibuatOlehId: user.id,
        });
        await tx.school.update({ where: { id: created.id }, data: { seatActivatedById: user.id } });
      }
      if (adminAuth) {
        await tx.user.create({
          data: { id: adminAuth.id, email: adminAuth.email, role: "admin_sekolah", status: "aktif" },
        });
        await tx.schoolUser.create({ data: { userId: adminAuth.id, schoolId: created.id } });
      }
      return tx.school.findUniqueOrThrow({ where: { id: created.id } });
    });

    const tempPasswordInfo = adminAuth ? { email: adminAuth.email, password: adminAuth.password } : null;

    await logAudit({
      userId: user.id,
      aksi: "create",
      entitas: "schools",
      entitasId: school.id,
      after: { ...school, adminCreated: Boolean(tempPasswordInfo) },
      ip: getClientIp(request),
    });

    return NextResponse.json({ school, tempPassword: tempPasswordInfo }, { status: 201 });
  } catch (error) {
    // Sekolah gagal disimpan: akun login admin yang sudah terlanjur dibuat
    // dihapus lagi supaya emailnya bisa dipakai saat mencoba ulang.
    if (adminAuth) {
      await createAdminClient().auth.admin.deleteUser(adminAuth.id).catch(() => {});
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "NPSN sudah terdaftar untuk sekolah lain." },
        { status: 409 },
      );
    }
    throw error;
  }
}
