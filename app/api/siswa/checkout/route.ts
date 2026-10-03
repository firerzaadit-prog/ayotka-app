import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { createSnapTransaction } from "@/lib/billing/midtrans";
import { getActiveEntitlement, kursiSekolahTersedia } from "@/lib/billing/entitlements";
import { PESAN_DITANGGUNG_SEKOLAH } from "@/lib/billing/kredit-pribadi-pesan";
import { SUMBER_KREDIT_PRIBADI } from "@/lib/billing/kredit-pribadi";
import {
  AFFILIATE_LINK_PLAN,
  buildKonfirmasiLanggananWa,
  getPaymentMode,
} from "@/lib/billing/pembayaran-affiliate";
import { z } from "zod";

const REFERRAL_DISCOUNT = 0.3;
/**
 * Kasus tepi #4 (Bagian 9 dokumen rencana): dokumen sumber tidak memberi
 * angka pasti untuk "batas maksimum per bulan", cuma menyarankan untuk
 * dipertimbangkan - 10/bulan/referrer dipakai sebagai nilai kerja awal,
 * bisa diubah admin pusat kalau ada aturan bisnis lain.
 */
const MAX_REFERRAL_DISCOUNTS_PER_MONTH = 10;

const checkoutSchema = z.object({ planId: z.string().uuid() });

/** Status entitlement siswa + plan yang bisa dibeli - dipakai halaman Langganan. */
export async function GET() {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    include: { school: { select: { nama: true } } },
  });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const now = new Date();
  const [active, plans, pendingInvoice, ditanggungSekolah, kreditTertunda] = await Promise.all([
    getActiveEntitlement(student.id),
    prisma.plan.findMany({ where: { kode: { in: ["monthly", "semester"] }, isActive: true }, orderBy: { harga: "asc" } }),
    prisma.invoice.findFirst({
      where: { studentId: student.id, status: "pending", expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    }),
    kursiSekolahTersedia(student, now),
    // Kredit pribadi yang ditunda karena sekolah sedang/akan menanggung (lib/billing/kredit-pribadi.ts): satu-satunya
    // baris pribadi yang bisa mulai di masa depan.
    prisma.entitlement.findMany({
      where: { studentId: student.id, source: { in: SUMBER_KREDIT_PRIBADI }, revokedAt: null, startsAt: { gt: now } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  const kreditDitunda =
    kreditTertunda.length > 0
      ? {
          mulai: new Date(Math.min(...kreditTertunda.map((k) => k.startsAt.getTime()))),
          sampai: new Date(Math.max(...kreditTertunda.map((k) => k.endsAt.getTime()))),
        }
      : null;

  // Mode pembayaran sementara (affiliate.id, aktivasi manual admin) - lihat
  // lib/billing/pembayaran-affiliate.ts. Di mode ini UI memakai tautan di
  // bawah, bukan tombol checkout Midtrans.
  const paymentMode = getPaymentMode();
  const affiliatePlans =
    paymentMode === "affiliate"
      ? Object.fromEntries(
          plans
            .filter((p) => AFFILIATE_LINK_PLAN[p.kode])
            .map((p) => [
              p.id,
              {
                url: AFFILIATE_LINK_PLAN[p.kode]!,
                waUrl: buildKonfirmasiLanggananWa({ namaPaket: p.nama, harga: p.harga, email: user.email }),
              },
            ]),
        )
      : null;

  return NextResponse.json({
    jalur: student.jalur,
    sekolah: student.school,
    /** Jalur A yang kursi sekolahnya berlaku/tersedia sekarang: tidak perlu (dan tidak boleh) membeli paket sendiri. */
    ditanggungSekolah,
    alumni: student.lulusAt !== null,
    kreditDitunda,
    paymentMode,
    affiliatePlans,
    referralCode: student.referralCode,
    entitlement: active
      ? {
        endsAt: active.entitlement.endsAt,
        canStartNewAttempt: active.canStartNewAttempt,
        canViewHistory: active.canViewHistory,
        source: active.entitlement.source,
      }
      : null,
    plans,
    pendingInvoiceId: pendingInvoice?.id ?? null,
  });
}

/**
 * Jalur A: buat invoice + transaksi Midtrans Snap. Diskon referral 30%
 * (Bagian 3 & 6.4) berlaku HANYA untuk transaksi pertama siswa yang
 * direferensikan - dicek dari ada/tidaknya invoice berstatus paid
 * sebelumnya, bukan dari kode referral itu sendiri (supaya tidak bisa
 * dipakai berulang oleh siswa yang sama).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  if (getPaymentMode() === "affiliate") {
    return NextResponse.json(
      {
        error:
          "Pembayaran saat ini dilakukan lewat tautan resmi AyoTKA di halaman Langganan, lalu dikonfirmasi ke admin via WhatsApp.",
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  // Siswa sekolah yang kursinya sedang ditanggung sekolah tidak perlu membeli sendiri (uangnya akan terpakai percuma).
  // Setelah sekolah berhenti/masa tenggang habis, atau setelah ditandai lulus, pembelian terbuka.
  if (await kursiSekolahTersedia(student)) {
    return NextResponse.json({ error: PESAN_DITANGGUNG_SEKOLAH, code: "DITANGGUNG_SEKOLAH" }, { status: 409 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } });
  if (!plan || !plan.isActive || !["monthly", "semester"].includes(plan.kode)) {
    return NextResponse.json({ error: "Plan tidak ditemukan atau tidak aktif." }, { status: 404 });
  }

  const existingPending = await prisma.invoice.findFirst({
    where: { studentId: student.id, status: "pending", expiresAt: { gt: new Date() } },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "Kamu masih punya invoice yang belum dibayar. Selesaikan atau tunggu kedaluwarsa dulu." },
      { status: 409 },
    );
  }

  let amount = plan.harga;
  if (student.referredByStudentId) {
    const paidBefore = await prisma.invoice.count({ where: { studentId: student.id, status: "paid" } });
    if (paidBefore === 0) {
      const startOfMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const referralsThisMonth = await prisma.invoice.count({
        where: {
          createdAt: { gte: startOfMonth },
          student: { referredByStudentId: student.referredByStudentId },
        },
      });
      if (referralsThisMonth < MAX_REFERRAL_DISCOUNTS_PER_MONTH) {
        amount = Math.round(plan.harga * (1 - REFERRAL_DISCOUNT));
      }
    }
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const invoice = await prisma.invoice.create({
    data: { studentId: student.id, planId: plan.id, amount, status: "pending", expiresAt },
  });

  let snap;
  try {
    snap = await createSnapTransaction({
      orderId: invoice.id,
      amount,
      customerName: student.nama,
      customerEmail: user.email,
    });
  } catch (error) {
    // Catatan invoice sudah dibuat berstatus pending SEBELUM memanggil Midtrans - kalau
    // Midtrans gagal (kunci belum diisi, salah mode, gangguan) dan dibiarkan, catatan itu
    // tertinggal pending dan memblokir percobaan berikutnya (409 "masih ada yang belum
    // dibayar") sampai kedaluwarsa 24 jam. Tidak ada uang/akses yang terlibat di titik ini,
    // jadi aman dihapus. Detail teknis hanya ke log server - pesan seperti "MIDTRANS_SERVER_KEY
    // belum diisi" atau respons mentah Midtrans tidak pantas tampil di layar siswa.
    await prisma.invoice.delete({ where: { id: invoice.id } }).catch(() => {});
    console.error("[pembayaran] gagal membuat transaksi Midtrans (invoice):", error);
    return NextResponse.json(
      { error: "Pembayaran belum dapat diproses saat ini. Silakan coba lagi beberapa saat lagi." },
      { status: 502 },
    );
  }

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "invoices",
    entitasId: invoice.id,
    after: invoice,
    ip: getClientIp(request),
  });

  return NextResponse.json(
    { invoiceId: invoice.id, token: snap.token, redirectUrl: snap.redirectUrl },
    { status: 201 },
  );
}
