import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/log";
import { SUMBER_KREDIT_PRIBADI, selaraskanKreditSiswaAman } from "@/lib/billing/kredit-pribadi";

export const AFFILIATE_PRODUCT_IDS = {
  TOPUP_50K: "jqKvm6YMT1YzqDwgdVey",
  TOPUP_25K: "KnvFM8Z81a42ut0ZkRHg",
  PLAN_MONTHLY: "OngB8kshcTdiPiai49fx",
  PLAN_SEMESTER: "T8rMqjdApjU940LkYgul",
} as const;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export type AffiliatePaymentPayload = {
  email?: string | null;
  userId?: string | null;
  studentId?: string | null;
  orderRef?: string | null;
  productId?: string | null;
  productTitle?: string | null;
  amount?: number | null;
  paymentChannel?: string | null;
  rawPayload?: unknown;
};

export type FulfillmentResult = {
  ok: boolean;
  message: string;
  type?: "topup" | "langganan";
  studentName?: string;
  nominal?: number;
  planName?: string;
  alreadyProcessed?: boolean;
};

/**
 * Memproses pemenuhan (fulfillment) otomatis ketika pembayaran via affiliate.id berhasil:
 * - Top-up saldo kredit (misal 50.000 / 25.000)
 * - Atau aktivasi paket langganan (Bulanan / Semester)
 *
 * Aman & Idempotent: jika webhook dipanggil ulang oleh affiliate.id, transaksi tidak akan diduplikasi.
 */
export async function processAffiliateFulfillment(
  payload: AffiliatePaymentPayload,
): Promise<FulfillmentResult> {
  const {
    email,
    userId,
    studentId,
    orderRef,
    productId,
    productTitle,
    amount,
    paymentChannel = "affiliate_id",
  } = payload;

  // 1. Cari profil siswa
  let student = null;

  if (studentId) {
    student = await prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      include: { user: true },
    });
  }

  if (!student && userId) {
    student = await prisma.student.findFirst({
      where: { userId, deletedAt: null },
      include: { user: true },
    });
  }

  if (!student && email) {
    const cleanEmail = email.trim();
    student = await prisma.student.findFirst({
      where: {
        deletedAt: null,
        user: { email: { equals: cleanEmail, mode: "insensitive" } },
      },
      include: { user: true },
    });
  }

  if (!student) {
    return {
      ok: false,
      message: `Siswa tidak ditemukan untuk data email: ${email || "-"}, userId: ${userId || "-"}, studentId: ${studentId || "-"}`,
    };
  }

  // 2. Tentukan jenis produk (Top-up saldo atau Paket Langganan)
  const normTitle = (productTitle || "").toLowerCase();
  const prodId = (productId || "").trim();

  let isTopup50k =
    prodId === AFFILIATE_PRODUCT_IDS.TOPUP_50K ||
    normTitle.includes("top up") && (normTitle.includes("50000") || normTitle.includes("50.000") || normTitle.includes("50rb")) ||
    (amount === 50_000 && normTitle.includes("top up"));

  let isTopup25k =
    prodId === AFFILIATE_PRODUCT_IDS.TOPUP_25K ||
    normTitle.includes("top up") && (normTitle.includes("25000") || normTitle.includes("25.000") || normTitle.includes("25rb")) ||
    (amount === 25_000 && normTitle.includes("top up"));

  let isPlanMonthly =
    prodId === AFFILIATE_PRODUCT_IDS.PLAN_MONTHLY ||
    normTitle.includes("bulanan") ||
    normTitle.includes("monthly") ||
    normTitle.includes("1 bulan");

  let isPlanSemester =
    prodId === AFFILIATE_PRODUCT_IDS.PLAN_SEMESTER ||
    normTitle.includes("semester") ||
    normTitle.includes("6 bulan");

  // Fallback jika hanya amount yang ada
  if (!isTopup50k && !isTopup25k && !isPlanMonthly && !isPlanSemester) {
    if (amount === 50_000) {
      // Default produk yang di screenshot user adalah Top Up 50.000
      isTopup50k = true;
    } else if (amount === 25_000) {
      isTopup25k = true;
    } else {
      // Coba tebak dari judul
      if (normTitle.includes("50")) isTopup50k = true;
      else if (normTitle.includes("25")) isTopup25k = true;
      else isTopup50k = true; // Default aman ke top-up 50k
    }
  }

  const effectiveRef = orderRef ? `affiliate_${orderRef}` : null;

  // 3. Eksekusi Top-Up Saldo
  if (isTopup50k || isTopup25k) {
    const nominal = isTopup50k ? 50_000 : 25_000;

    // Idempotency: periksa apakah order ini sudah pernah diproses
    if (effectiveRef) {
      const existingTx = await prisma.saldoTransaction.findFirst({
        where: { gatewayRef: effectiveRef },
      });
      if (existingTx) {
        return {
          ok: true,
          message: "Transaksi top-up sudah pernah diproses sebelumnya (idempotent).",
          type: "topup",
          studentName: student.nama,
          nominal: existingTx.jumlah,
          alreadyProcessed: true,
        };
      }
    }

    const tx = await prisma.saldoTransaction.create({
      data: {
        studentId: student.id,
        tipe: "topup",
        status: "berhasil",
        jumlah: nominal,
        keterangan: `Top-up saldo ${nominal} via affiliate.id (otomatis)`,
        gatewayRef: effectiveRef,
        paymentChannel,
      },
    });

    await logAudit({
      userId: student.userId,
      aksi: "create",
      entitas: "saldo_transactions",
      entitasId: tx.id,
      after: {
        aksi: "affiliate_topup_otomatis",
        studentId: student.id,
        jumlah: nominal,
        gatewayRef: tx.gatewayRef,
        rawPayload: payload.rawPayload,
      },
    });

    return {
      ok: true,
      message: `Top-up saldo ${nominal} berhasil ditambahkan ke ${student.nama}.`,
      type: "topup",
      studentName: student.nama,
      nominal,
    };
  }

  // 4. Eksekusi Paket Langganan
  const planKode = isPlanSemester ? "semester" : "monthly";
  const plan = await prisma.plan.findFirst({
    where: { kode: planKode, isActive: true },
  });

  if (!plan) {
    return {
      ok: false,
      message: `Paket langganan (${planKode}) tidak ditemukan di database.`,
    };
  }

  // Idempotency: periksa apakah order ini sudah pernah diproses
  if (effectiveRef) {
    const existingInv = await prisma.invoice.findFirst({
      where: { gatewayRef: effectiveRef },
    });
    if (existingInv) {
      return {
        ok: true,
        message: "Transaksi langganan sudah pernah diproses sebelumnya (idempotent).",
        type: "langganan",
        studentName: student.nama,
        planName: plan.nama,
        alreadyProcessed: true,
      };
    }
  }

  const startsAt = new Date();
  const aktifPribadi = await prisma.entitlement.findFirst({
    where: {
      studentId: student.id,
      source: { in: SUMBER_KREDIT_PRIBADI },
      revokedAt: null,
      startsAt: { lte: startsAt },
      endsAt: { gt: startsAt },
    },
    orderBy: { endsAt: "desc" },
    select: { endsAt: true },
  });
  const dasar = aktifPribadi ? aktifPribadi.endsAt : startsAt;
  const endsAt = addDays(dasar, plan.durasiHari ?? 30);

  const [invoice] = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        studentId: student.id,
        planId: plan.id,
        amount: plan.harga,
        status: "paid",
        gatewayRef: effectiveRef,
        paymentChannel,
        expiresAt: startsAt,
      },
    });

    await tx.entitlement.create({
      data: {
        studentId: student.id,
        planId: plan.id,
        startsAt,
        endsAt,
        source: "invoice",
        invoiceId: inv.id,
      },
    });

    return [inv] as const;
  });

  await selaraskanKreditSiswaAman(prisma, student.id);

  await logAudit({
    userId: student.userId,
    aksi: "create",
    entitas: "invoices",
    entitasId: invoice.id,
    after: {
      aksi: "affiliate_langganan_otomatis",
      studentId: student.id,
      planKode: plan.kode,
      amount: plan.harga,
      gatewayRef: invoice.gatewayRef,
      rawPayload: payload.rawPayload,
    },
  });

  return {
    ok: true,
    message: `Paket ${plan.nama} berhasil diaktifkan untuk ${student.nama}.`,
    type: "langganan",
    studentName: student.nama,
    planName: plan.nama,
  };
}
