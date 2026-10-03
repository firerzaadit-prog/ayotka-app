import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { voucherRedeemSchema } from "@/lib/validations/partner";
import { activateVoucher, VoucherSudahDipakaiError } from "@/lib/billing/vouchers";
import { kursiSekolahTersedia } from "@/lib/billing/entitlements";
import { PESAN_DITANGGUNG_SEKOLAH } from "@/lib/billing/kredit-pribadi-pesan";
import { selaraskanKreditSiswaAman } from "@/lib/billing/kredit-pribadi";

/**
 * Jalur C (Bagian 5 & 6.5 dokumen rencana): siswa mandiri menukar kode
 * voucher dari mitra langsung jadi entitlement - TIDAK PERNAH membuat
 * invoice (beda dari Jalur A/Midtrans di app/api/siswa/checkout).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = voucherRedeemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  // Voucher tidak boleh terpakai percuma selagi sekolah menanggung: kodenya dibiarkan utuh (belum terpakai) agar bisa
  // dipakai nanti setelah sekolah berhenti menanggung atau siswa lulus.
  if (await kursiSekolahTersedia(student)) {
    return NextResponse.json({ error: PESAN_DITANGGUNG_SEKOLAH, code: "DITANGGUNG_SEKOLAH" }, { status: 409 });
  }

  const code = parsed.data.code.trim().toUpperCase();
  const voucher = await prisma.voucher.findUnique({ where: { code }, include: { plan: true } });
  if (!voucher) {
    return NextResponse.json({ error: "Kode voucher tidak ditemukan." }, { status: 404 });
  }
  if (voucher.status !== "unused") {
    return NextResponse.json(
      { error: voucher.status === "used" ? "Kode voucher ini sudah dipakai." : "Kode voucher ini sudah tidak berlaku." },
      { status: 409 },
    );
  }

  const entitlement = await prisma
    .$transaction((tx) =>
      activateVoucher(tx, {
        voucherId: voucher.id,
        planId: voucher.planId,
        partnerId: voucher.partnerId,
        durasiHari: voucher.plan.durasiHari,
        studentId: student.id,
      }),
    )
    .catch((error) => {
      if (error instanceof VoucherSudahDipakaiError) return null;
      throw error;
    });

  if (!entitlement) {
    return NextResponse.json({ error: "Kode voucher ini sudah dipakai." }, { status: 409 });
  }

  // Bila sekolah akan menanggung pada masa voucher ini berlaku (periode sudah dibuat tetapi belum mulai), sisa harinya
  // ditunda. Aman: galat di sini tidak membatalkan penukaran yang sudah berhasil.
  await selaraskanKreditSiswaAman(prisma, student.id);

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "vouchers",
    entitasId: voucher.id,
    after: { status: "used", studentId: student.id },
    ip: getClientIp(request),
  });

  return NextResponse.json({ entitlement }, { status: 201 });
}
