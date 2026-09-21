import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { generateTempPassword } from "@/lib/utils/generate-code";
import { generateUniqueReferralCode } from "@/lib/partners/create";
import { partnerCreateSchema } from "@/lib/validations/partner";

/** GET: daftar mitra + ringkasan jumlah voucher untuk halaman Mitra & Voucher admin pusat. */
export async function GET() {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const partners = await prisma.partner.findMany({
    include: {
      user: { select: { email: true } },
      _count: { select: { vouchers: true, schools: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const usedCounts = await prisma.voucher.groupBy({
    by: ["partnerId"],
    where: { status: "used" },
    _count: { _all: true },
  });
  const usedByPartner = new Map(usedCounts.map((u) => [u.partnerId, u._count._all]));
  const siswaCounts = await prisma.student.groupBy({
    by: ["referredByPartnerId"],
    where: { referredByPartnerId: { not: null }, deletedAt: null },
    _count: { _all: true },
  });
  const siswaByPartner = new Map(siswaCounts.map((c) => [c.referredByPartnerId, c._count._all]));

  return NextResponse.json({
    partners: partners.map((p) => ({
      id: p.id,
      nama: p.nama,
      kontak: p.kontak,
      email: p.user.email,
      referralCode: p.referralCode,
      totalVoucher: p._count.vouchers,
      voucherTerpakai: usedByPartner.get(p.id) ?? 0,
      totalSekolahRujukan: p._count.schools,
      siswaViaKode: siswaByPartner.get(p.id) ?? 0,
    })),
  });
}

/**
 * Jalur C (Bagian 5 & 6.5 dokumen rencana): admin pusat membuat akun mitra
 * baru - pola sama persis dengan pembuatan akun admin sekolah/dinas
 * pendidikan (app/api/admin-pusat/school-admins, dinas-admins). Password
 * sementara HANYA dikembalikan sekali di response ini, tidak pernah disimpan.
 */
export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = partnerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const { email, nama, kontak } = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email ini sudah dipakai akun lain." }, { status: 409 });
  }

  const referralCode = await generateUniqueReferralCode();
  const tempPassword = generateTempPassword();
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    app_metadata: { role: "mitra" },
    user_metadata: { must_change_password: true, nama },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: `Gagal membuat akun: ${error?.message ?? "unknown error"}` },
      { status: 502 },
    );
  }

  const [, partner] = await prisma.$transaction([
    prisma.user.create({
      data: { id: data.user.id, email, role: "mitra", status: "aktif" },
    }),
    prisma.partner.create({
      data: { userId: data.user.id, nama, kontak: kontak ?? null, referralCode },
    }),
  ]);

  await logAudit({
    userId: actor.id,
    aksi: "create",
    entitas: "partners",
    entitasId: partner.id,
    after: { userId: data.user.id, email, nama, referralCode },
    ip: getClientIp(request),
  });

  return NextResponse.json({ partner, tempPassword }, { status: 201 });
}
