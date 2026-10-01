import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { getActiveEntitlement } from "@/lib/billing/entitlements";
import { getSaldo } from "@/lib/billing/saldo";
import { aktivasiManualSchema, JENDELA_DUPLIKAT_MS } from "@/lib/validations/aktivasi-manual";

const CHANNEL_MANUAL = "affiliate_manual";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Cari siswa mandiri (Jalur B) untuk diaktivasi manual: nama, email, atau NISN.
 * Hasil memuat status langganan & saldo sekarang supaya admin bisa melihat
 * kondisi akun sebelum mengaktifkan (mis. sudah punya langganan aktif).
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) {
    return NextResponse.json({ students: [] });
  }

  const students = await prisma.student.findMany({
    where: {
      deletedAt: null,
      jalur: "B",
      OR: [
        { nama: { contains: q, mode: "insensitive" } },
        { nisn: { contains: q } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    },
    orderBy: { nama: "asc" },
    take: 10,
    select: { id: true, nama: true, jenjang: true, user: { select: { email: true } } },
  });

  const hasil = await Promise.all(
    students.map(async (s) => {
      const [aktif, saldo] = await Promise.all([getActiveEntitlement(s.id), getSaldo(s.id)]);
      return {
        id: s.id,
        nama: s.nama,
        jenjang: s.jenjang,
        email: s.user?.email ?? null,
        saldo,
        langgananAktifSampai: aktif?.canStartNewAttempt ? aktif.entitlement.endsAt : null,
      };
    }),
  );

  return NextResponse.json({ students: hasil });
}

/**
 * Aktivasi manual setelah siswa membayar lewat tautan affiliate.id. Langganan
 * memakai jalur data yang SAMA dengan webhook Midtrans (Invoice paid +
 * Entitlement mulai sekarang, source "invoice"), supaya seluruh logika akses
 * (getActiveEntitlement, jatah AI, laporan Pendapatan) tidak perlu tahu
 * bedanya. Top-up menambah baris saldo berstatus berhasil.
 */
export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = aktivasiManualSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }
  const input = parsed.data;

  const student = await prisma.student.findFirst({
    where: { id: input.studentId, deletedAt: null, jalur: "B" },
    select: { id: true, nama: true },
  });
  if (!student) {
    return NextResponse.json({ error: "Siswa mandiri tidak ditemukan." }, { status: 404 });
  }

  const sejak = new Date(Date.now() - JENDELA_DUPLIKAT_MS);
  const ip = getClientIp(request);

  if (input.tipe === "langganan") {
    const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan || !plan.isActive || !["monthly", "semester"].includes(plan.kode)) {
      return NextResponse.json({ error: "Paket tidak ditemukan atau tidak aktif." }, { status: 404 });
    }

    const duplikat = await prisma.invoice.findFirst({
      where: {
        studentId: student.id,
        planId: plan.id,
        status: "paid",
        paymentChannel: CHANNEL_MANUAL,
        createdAt: { gte: sejak },
      },
      select: { id: true },
    });
    if (duplikat) {
      return NextResponse.json(
        { error: "Paket yang sama baru saja diaktifkan untuk siswa ini. Cek status siswa sebelum mengaktifkan lagi." },
        { status: 409 },
      );
    }

    // Kalau siswa masih punya langganan aktif, masa aktif baru DITAMBAHKAN setelah
    // yang lama habis (bukan menimpa) - siswa sudah membayar penuh, jangan sampai
    // sisa harinya hangus. getActiveEntitlement mengambil endsAt terjauh, jadi
    // entitlement baru yang berakhir lebih jauh otomatis jadi yang berlaku.
    const startsAt = new Date();
    const aktif = await getActiveEntitlement(student.id);
    const dasar = aktif?.canStartNewAttempt && aktif.entitlement.endsAt > startsAt ? aktif.entitlement.endsAt : startsAt;
    const endsAt = addDays(dasar, plan.durasiHari ?? 30);
    const [invoice, entitlement] = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          studentId: student.id,
          planId: plan.id,
          amount: plan.harga,
          status: "paid",
          paymentChannel: CHANNEL_MANUAL,
          expiresAt: startsAt,
        },
      });
      const ent = await tx.entitlement.create({
        data: { studentId: student.id, planId: plan.id, startsAt, endsAt, source: "invoice", invoiceId: inv.id },
      });
      return [inv, ent] as const;
    });

    await logAudit({
      userId: actor.id,
      aksi: "create",
      entitas: "invoices",
      entitasId: invoice.id,
      after: { aksi: "aktivasi_manual_langganan", studentId: student.id, planKode: plan.kode, amount: plan.harga, catatan: input.catatan },
      ip,
    });

    return NextResponse.json({ ok: true, tipe: "langganan", siswa: student.nama, paket: plan.nama, berlakuSampai: entitlement.endsAt }, { status: 201 });
  }

  const duplikat = await prisma.saldoTransaction.findFirst({
    where: {
      studentId: student.id,
      tipe: "topup",
      status: "berhasil",
      paymentChannel: CHANNEL_MANUAL,
      jumlah: input.nominal,
      createdAt: { gte: sejak },
    },
    select: { id: true },
  });
  if (duplikat) {
    return NextResponse.json(
      { error: "Top-up dengan nominal yang sama baru saja ditambahkan untuk siswa ini. Cek saldo siswa sebelum menambah lagi." },
      { status: 409 },
    );
  }

  const tx = await prisma.saldoTransaction.create({
    data: {
      studentId: student.id,
      tipe: "topup",
      status: "berhasil",
      jumlah: input.nominal,
      keterangan: `Top-up saldo ${input.nominal} via affiliate.id (dikonfirmasi admin)`,
      paymentChannel: CHANNEL_MANUAL,
      createdById: actor.id,
    },
  });

  await logAudit({
    userId: actor.id,
    aksi: "create",
    entitas: "saldo_transactions",
    entitasId: tx.id,
    after: { aksi: "aktivasi_manual_topup", studentId: student.id, jumlah: input.nominal, catatan: input.catatan },
    ip,
  });

  const saldoBaru = await getSaldo(student.id);
  return NextResponse.json({ ok: true, tipe: "topup", siswa: student.nama, nominal: input.nominal, saldoBaru }, { status: 201 });
}
