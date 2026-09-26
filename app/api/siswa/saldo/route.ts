import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { createSnapTransaction } from "@/lib/billing/midtrans";
import { getSaldo, getHargaLearningAnalytics } from "@/lib/billing/saldo";
import { saldoTopupSchema, SALDO_TOPUP_DENOMINASI } from "@/lib/validations/saldo";

/**
 * Bagian D/G (permintaan user): wallet/saldo siswa untuk beli Learning
 * Analytics tambahan di luar jatah plan. Top-up lewat Midtrans (webhook
 * sama dengan invoice/voucher order - lihat app/api/webhooks/midtrans),
 * pemakaian saldo untuk analisis didebit langsung lewat lib/billing/saldo.ts
 * saat finalize attempt, bukan lewat endpoint ini.
 */
export async function GET() {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const [saldo, hargaLearningAnalytics, riwayat] = await Promise.all([
    getSaldo(student.id),
    getHargaLearningAnalytics(),
    prisma.saldoTransaction.findMany({
      where: { studentId: student.id, status: { not: "pending" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    saldo,
    hargaLearningAnalytics,
    denominasi: SALDO_TOPUP_DENOMINASI,
    riwayat,
  });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = saldoTopupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tx = await prisma.saldoTransaction.create({
    data: {
      studentId: student.id,
      tipe: "topup",
      status: "pending",
      jumlah: parsed.data.nominal,
      keterangan: `Top-up saldo ${parsed.data.nominal}`,
      expiresAt,
    },
  });

  let snap;
  try {
    snap = await createSnapTransaction({
      orderId: tx.id,
      amount: parsed.data.nominal,
      customerName: student.nama,
      customerEmail: user.email,
    });
  } catch (error) {
    // Catatan top-up saldo sudah dibuat berstatus pending SEBELUM memanggil Midtrans - kalau
    // Midtrans gagal (kunci belum diisi, salah mode, gangguan) dan dibiarkan, catatan itu
    // tertinggal pending dan memblokir percobaan berikutnya (409 "masih ada yang belum
    // dibayar") sampai kedaluwarsa 24 jam. Tidak ada uang/akses yang terlibat di titik ini,
    // jadi aman dihapus. Detail teknis hanya ke log server - pesan seperti "MIDTRANS_SERVER_KEY
    // belum diisi" atau respons mentah Midtrans tidak pantas tampil di layar siswa.
    await prisma.saldoTransaction.delete({ where: { id: tx.id } }).catch(() => {});
    console.error("[pembayaran] gagal membuat transaksi Midtrans (top-up saldo):", error);
    return NextResponse.json(
      { error: "Pembayaran belum dapat diproses saat ini. Silakan coba lagi beberapa saat lagi." },
      { status: 502 },
    );
  }

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "saldo_transactions",
    entitasId: tx.id,
    after: tx,
    ip: getClientIp(request),
  });

  return NextResponse.json({ orderId: tx.id, token: snap.token, redirectUrl: snap.redirectUrl }, { status: 201 });
}
