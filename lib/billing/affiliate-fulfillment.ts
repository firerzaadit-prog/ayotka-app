import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/log";
import { SUMBER_KREDIT_PRIBADI, selaraskanKreditSiswaAman } from "@/lib/billing/kredit-pribadi";
import { jenisDariKode, type JenisProduk } from "@/lib/billing/affiliate-produk";
import { ringkasDataDiterima } from "@/lib/billing/affiliate-data";
import { studentIdDariEmailPembayaran } from "@/lib/billing/email-pembayaran";
import { kirimStrukKeEmailKontak } from "@/lib/email/struk-pembayaran";

export type { JenisProduk };

export const AFFILIATE_PRODUCT_IDS = {
  TOPUP_50K: "jqKvm6YMT1YzqDwgdVey",
  TOPUP_25K: "KnvFM8Z81a42ut0ZkRHg",
  PLAN_MONTHLY: "OngB8kshcTdiPiai49fx",
  PLAN_SEMESTER: "T8rMqjdApjU940LkYgul",
} as const;

/** Dua panggilan untuk satu pembayaran (webhook Purchase dan Success SaaS) datang berdekatan; di dalam jendela ini yang kedua dianggap ganda. */
export const JENDELA_GANDA_MENIT = 5;

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
  /** Kode produk dari alamat panggilan (`?produk=`, lihat affiliate-produk.ts); didahulukan karena alamatnya rahasia. */
  produkKode?: string | null;
  paymentChannel?: string | null;
  rawPayload?: unknown;
};

export type KodeGagal = "siswa_tidak_ditemukan" | "produk_tidak_dikenal" | "paket_tidak_ada";

export type FulfillmentResult = {
  ok: boolean;
  message: string;
  /** Hanya pada kegagalan: dicatat di audit log supaya admin bisa menindaklanjuti. */
  kode?: KodeGagal;
  type?: "topup" | "langganan";
  studentName?: string;
  nominal?: number;
  planName?: string;
  alreadyProcessed?: boolean;
};

/**
 * Produk mana yang dibayar. Urutan: ID produk persis -> judul produk -> (hanya bila tidak ada judul) nominal persis
 * 25.000 / 50.000. Produk yang tidak dikenali menghasilkan null dan DITOLAK; dulu produk tak dikenal diam-diam dianggap
 * top-up 50.000, jadi panggilan apa pun bisa mengisi saldo.
 */
export function tentukanProdukAffiliate(p: {
  productId?: string | null;
  productTitle?: string | null;
  amount?: number | null;
}): JenisProduk | null {
  const id = (p.productId ?? "").trim();
  if (id === AFFILIATE_PRODUCT_IDS.TOPUP_50K) return "topup_50k";
  if (id === AFFILIATE_PRODUCT_IDS.TOPUP_25K) return "topup_25k";
  if (id === AFFILIATE_PRODUCT_IDS.PLAN_SEMESTER) return "langganan_semester";
  if (id === AFFILIATE_PRODUCT_IDS.PLAN_MONTHLY) return "langganan_bulanan";

  const amount = typeof p.amount === "number" && Number.isFinite(p.amount) ? p.amount : null;
  const judul = (p.productTitle ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (judul) {
    if (/top\s?up/.test(judul)) {
      if (/50000|50\.000|50\s?rb/.test(judul)) return "topup_50k";
      if (/25000|25\.000|25\s?rb/.test(judul)) return "topup_25k";
      if (amount === 50_000) return "topup_50k";
      if (amount === 25_000) return "topup_25k";
      return null;
    }
    if (/semester|6 bulan/.test(judul)) return "langganan_semester";
    if (/bulanan|monthly|1 bulan/.test(judul)) return "langganan_bulanan";
    return null;
  }

  if (amount === 50_000) return "topup_50k";
  if (amount === 25_000) return "topup_25k";
  return null;
}

/** Kegagalan unik database (gatewayRef sudah ada): dua panggilan untuk order yang sama berpapasan; yang kedua bukan galat. */
function adalahPelanggaranUnik(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
}

async function catat(
  entitas: "affiliate_callback_gagal" | "affiliate_callback_ganda",
  payload: AffiliatePaymentPayload,
  kode: string,
  pesan: string,
): Promise<void> {
  await logAudit({
    userId: null,
    aksi: "create",
    entitas,
    entitasId: payload.orderRef?.trim() || "-",
    after: {
      kode,
      pesan,
      email: payload.email ?? null,
      userId: payload.userId ?? null,
      studentId: payload.studentId ?? null,
      productId: payload.productId ?? null,
      productTitle: payload.productTitle ?? null,
      amount: payload.amount ?? null,
      produkKode: payload.produkKode ?? null,
      channel: payload.paymentChannel ?? null,
      // Data mentah yang diterima, supaya admin bisa melihat apa yang sebenarnya dikirim affiliate.id tanpa membuka log server.
      dataDiterima: ringkasDataDiterima(payload.rawPayload),
    },
  });
}

async function gagal(payload: AffiliatePaymentPayload, kode: KodeGagal, message: string): Promise<FulfillmentResult> {
  await catat("affiliate_callback_gagal", payload, kode, message);
  return { ok: false, message, kode };
}

/**
 * Memproses pemenuhan (fulfillment) otomatis ketika pembayaran via affiliate.id berhasil:
 * - Top-up saldo kredit (misal 50.000 / 25.000)
 * - Atau aktivasi paket langganan (Bulanan / Semester)
 *
 * Pemanggil WAJIB sudah memverifikasi rahasia webhook (lib/billing/affiliate-auth.ts); fungsi ini tidak tahu siapa pemanggilnya.
 *
 * Aman terhadap panggilan berulang: (1) nomor order yang sama tidak diproses dua kali (gatewayRef unik), dan (2) siswa +
 * produk yang sama dalam JENDELA_GANDA_MENIT menit dianggap panggilan ganda untuk pembayaran yang sama (webhook Purchase
 * dan Success SaaS bisa menembak bersamaan dengan nama parameter nomor order yang berbeda). Kegagalan dan dugaan ganda
 * dicatat di audit log (entitas affiliate_callback_gagal / affiliate_callback_ganda) agar admin bisa menindaklanjuti.
 */
export async function processAffiliateFulfillment(
  payload: AffiliatePaymentPayload,
): Promise<FulfillmentResult> {
  const { email, userId, studentId, orderRef, productId, productTitle, produkKode, paymentChannel = "affiliate_id" } = payload;
  const amount = typeof payload.amount === "number" && Number.isFinite(payload.amount) ? payload.amount : null;

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

  // Alamat pembayaran khusus akun NISN (lib/billing/email-pembayaran.ts) langsung menunjuk ID siswanya.
  const idDariAlamat = !student && email ? studentIdDariEmailPembayaran(email) : null;
  if (idDariAlamat) {
    student = await prisma.student.findFirst({
      where: { id: idDariAlamat, deletedAt: null },
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
    return gagal(
      payload,
      "siswa_tidak_ditemukan",
      `Siswa tidak ditemukan untuk data email: ${email || "-"}, userId: ${userId || "-"}, studentId: ${studentId || "-"}`,
    );
  }

  // 2. Tentukan jenis produk (Top-up saldo atau Paket Langganan); produk tak dikenal ditolak
  // Kode produk dari alamat didahulukan; bila ada tetapi salah ketik, ditolak (bukan ditebak dari data lain).
  const produk = produkKode?.trim() ? jenisDariKode(produkKode) : tentukanProdukAffiliate({ productId, productTitle, amount });
  if (!produk) {
    const petunjuk = produkKode?.trim()
      ? `Kode produk di alamat tidak dikenal ("${produkKode.trim().slice(0, 40)}"); salin ulang alamat Success dari Admin Pusat > Verifikasi Pembayaran.`
      : !productId && !productTitle && amount === null
        ? " Panggilan tidak membawa produk: isi Success (New/Existing User) di affiliate.id dengan alamat Success untuk produk itu dari Admin Pusat > Verifikasi Pembayaran."
        : "";
    return gagal(
      payload,
      "produk_tidak_dikenal",
      `Produk tidak dikenali (id: ${productId || "-"}, judul: ${productTitle || "-"}, nominal: ${amount ?? "-"}); tidak ada yang diproses. ${petunjuk}`.trim(),
    );
  }

  const ref = orderRef?.trim().slice(0, 120);
  const effectiveRef = ref ? `affiliate_${ref}` : null;
  const batasGanda = new Date(Date.now() - JENDELA_GANDA_MENIT * 60_000);

  // 3. Eksekusi Top-Up Saldo
  if (produk === "topup_50k" || produk === "topup_25k") {
    const nominal = produk === "topup_50k" ? 50_000 : 25_000;

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

    // Panggilan ganda untuk pembayaran yang sama (nomor order berbeda atau tidak ada)
    const gandaTx = await prisma.saldoTransaction.findFirst({
      where: {
        studentId: student.id,
        tipe: "topup",
        status: "berhasil",
        jumlah: nominal,
        paymentChannel: { startsWith: "affiliate" },
        createdAt: { gte: batasGanda },
      },
    });
    if (gandaTx) {
      const pesan = `Diduga panggilan ganda: top-up ${nominal} untuk siswa ini sudah diproses dalam ${JENDELA_GANDA_MENIT} menit terakhir; tidak ditambahkan lagi.`;
      await catat("affiliate_callback_ganda", payload, "diduga_ganda", pesan);
      return {
        ok: true,
        message: pesan,
        type: "topup",
        studentName: student.nama,
        nominal,
        alreadyProcessed: true,
      };
    }

    let tx;
    try {
      tx = await prisma.saldoTransaction.create({
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
    } catch (err) {
      if (!adalahPelanggaranUnik(err)) throw err;
      return {
        ok: true,
        message: "Transaksi top-up sudah pernah diproses sebelumnya (idempotent).",
        type: "topup",
        studentName: student.nama,
        nominal,
        alreadyProcessed: true,
      };
    }

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

    // Struk ke email kontak akun NISN (yang email loginnya tidak bisa menerima apa pun). Tidak ditunggu dan tidak pernah
    // melempar: struk hanya tambahan, tidak boleh memperlambat atau menggagalkan pembayaran yang sudah masuk.
    void kirimStrukKeEmailKontak(student, { jenis: "topup", nominal }).catch(() => undefined);

    return {
      ok: true,
      message: `Top-up saldo ${nominal} berhasil ditambahkan ke ${student.nama}.`,
      type: "topup",
      studentName: student.nama,
      nominal,
    };
  }

  // 4. Eksekusi Paket Langganan
  const planKode = produk === "langganan_semester" ? "semester" : "monthly";
  const plan = await prisma.plan.findFirst({
    where: { kode: planKode, isActive: true },
  });

  if (!plan) {
    return gagal(payload, "paket_tidak_ada", `Paket langganan (${planKode}) tidak ditemukan di database.`);
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

  // Panggilan ganda untuk pembayaran yang sama (nomor order berbeda atau tidak ada)
  const gandaInv = await prisma.invoice.findFirst({
    where: {
      studentId: student.id,
      planId: plan.id,
      status: "paid",
      paymentChannel: { startsWith: "affiliate" },
      createdAt: { gte: batasGanda },
    },
  });
  if (gandaInv) {
    const pesan = `Diduga panggilan ganda: paket ${plan.nama} untuk siswa ini sudah diaktifkan dalam ${JENDELA_GANDA_MENIT} menit terakhir; tidak diaktifkan lagi.`;
    await catat("affiliate_callback_ganda", payload, "diduga_ganda", pesan);
    return {
      ok: true,
      message: pesan,
      type: "langganan",
      studentName: student.nama,
      planName: plan.nama,
      alreadyProcessed: true,
    };
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

  let invoice;
  try {
    [invoice] = await prisma.$transaction(async (tx) => {
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
  } catch (err) {
    if (!adalahPelanggaranUnik(err)) throw err;
    return {
      ok: true,
      message: "Transaksi langganan sudah pernah diproses sebelumnya (idempotent).",
      type: "langganan",
      studentName: student.nama,
      planName: plan.nama,
      alreadyProcessed: true,
    };
  }

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

  // Struk ke email kontak akun NISN (lihat catatan di cabang top-up).
  void kirimStrukKeEmailKontak(student, { jenis: "langganan", namaPaket: plan.nama, harga: plan.harga, berlakuSampai: endsAt }).catch(
    () => undefined,
  );

  return {
    ok: true,
    message: `Paket ${plan.nama} berhasil diaktifkan untuk ${student.nama}.`,
    type: "langganan",
    studentName: student.nama,
    planName: plan.nama,
  };
}
