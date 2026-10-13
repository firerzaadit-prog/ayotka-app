import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { createSnapTransaction } from "@/lib/billing/midtrans";
import { getSaldo, getKonfigHargaLA } from "@/lib/billing/saldo";
import { rentangHargaLA } from "@/lib/billing/harga-la";
import { emailUntukCheckout } from "@/lib/billing/email-pembayaran";
import { saldoTopupSchema, SALDO_TOPUP_DENOMINASI } from "@/lib/validations/saldo";
import {
  AFFILIATE_SLUG_TOPUP,
  buildAffiliateUrl,
  buildKonfirmasiTopupWa,
  getPaymentMode,
} from "@/lib/billing/pembayaran-affiliate";

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

  const [saldo, konfigHargaLA, riwayat] = await Promise.all([
    getSaldo(student.id),
    getKonfigHargaLA(),
    prisma.saldoTransaction.findMany({
      where: { studentId: student.id, status: { not: "pending" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // Mode affiliate.id: hanya nominal yang punya produk di sana yang ditawarkan,
  // masing-masing dengan tautan bayar + pesan konfirmasi WhatsApp siap kirim.
  // Lihat lib/billing/pembayaran-affiliate.ts.
  const paymentMode = getPaymentMode();
  // Email yang dibawa ke checkout: email akun, atau alamat pembayaran khusus untuk akun NISN.
  const emailCheckout = emailUntukCheckout(user.email, student.id);
  const affiliateTopup =
    paymentMode === "affiliate"
      ? Object.fromEntries(
          SALDO_TOPUP_DENOMINASI.filter((n) => Boolean(AFFILIATE_SLUG_TOPUP[n as keyof typeof AFFILIATE_SLUG_TOPUP])).map((n) => [
            n,
            {
              url: buildAffiliateUrl(AFFILIATE_SLUG_TOPUP[n as keyof typeof AFFILIATE_SLUG_TOPUP], {
                email: emailCheckout,
              }),
              waUrl: buildKonfirmasiTopupWa({ nominal: n, email: user.email }),
            },
          ]),
        )
      : null;

  return NextResponse.json({
    saldo,
    /** Email yang dipakai di checkout affiliate.id (email akun, atau alamat pembayaran khusus akun NISN), untuk petunjuk di halaman. */
    email: emailCheckout,
    // Harga Learning Analytics tambahan mengikuti beban AI paket (Rp min sampai Rp maks); harga pastinya
    // tampil di halaman petunjuk ujian dan di kartu Learning Analytics hasil ujian. hargaLearningAnalytics (= harga
    // termurah) hanya dipertahankan untuk halaman Wallet lama yang masih terbuka di peramban saat versi baru dipasang.
    hargaLaMin: rentangHargaLA(konfigHargaLA).min,
    hargaLaMaks: rentangHargaLA(konfigHargaLA).maks,
    hargaLearningAnalytics: rentangHargaLA(konfigHargaLA).min,
    denominasi: affiliateTopup
      ? SALDO_TOPUP_DENOMINASI.filter((n) => Boolean(affiliateTopup[n]))
      : SALDO_TOPUP_DENOMINASI,
    paymentMode,
    affiliateTopup,
    waKonfirmasiUmum: paymentMode === "affiliate" ? buildKonfirmasiTopupWa({ nominal: null, email: user.email }) : null,
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

  if (getPaymentMode() === "affiliate") {
    return NextResponse.json(
      {
        error:
          "Top-up saat ini dilakukan lewat tautan resmi AyoTKA di halaman Wallet, lalu dikonfirmasi ke admin via WhatsApp.",
      },
      { status: 409 },
    );
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
