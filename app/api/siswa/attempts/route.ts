import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { getActiveAssignmentsFor, getSelfSelectPackagesFor } from "@/lib/exam/visibility";
import { statusSeriMandiri } from "@/lib/exam/seri-mandiri";
import { formatWIBDate, formatWIBHariTanggalJam } from "@/lib/utils/datetime";
import { sanitizeAttemptForClient } from "@/lib/exam/attempt-access";
import { isExpired } from "@/lib/exam/timing";
import { finalizeAttempt } from "@/lib/exam/finalize";
import { canStartAttempt, getActiveEntitlement, type AccessCheckResult } from "@/lib/billing/entitlements";
import { getAiKuotaRemaining, getTryOutNasionalKuotaRemaining } from "@/lib/billing/plan-fitur";
import { getSaldo, getHargaLearningAnalytics } from "@/lib/billing/saldo";
import { putuskanLearningAnalytics, type TipeAkses } from "@/lib/billing/learning-analytics";
import { nomorPercobaanById } from "@/lib/exam/percobaan";
import { z } from "zod";

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Bagian 9 kasus tepi #6: waiting_for_seat beda dari quota_required biasa -
 * pesannya menjelaskan bahwa ini otomatis pulih begitu admin menambah
 * kuota, bukan jalan buntu yang perlu tindakan siswa (mis. beli paket).
 */
function accessDeniedResponse(access: Extract<AccessCheckResult, { allowed: false }>, quotaRequiredMessage: string) {
  // Sekolah "dibekukan": langganan sekolah sudah berakhir (termasuk masa tenggang). Riwayat dan nilai siswa tetap
  // bisa dibuka; yang diblokir hanya memulai ujian baru. Pesannya menunjuk ke admin sekolah, bukan ke pembelian paket.
  if (access.reason === "sekolah_berakhir") {
    return NextResponse.json(
      {
        error: `Langganan sekolahmu berakhir pada ${formatWIBDate(access.berakhir)}. Hubungi admin sekolahmu untuk perpanjangan, atau lanjut belajar dengan paket pribadi di menu Langganan. Riwayat dan nilaimu tetap bisa dibuka.`,
        code: "SEKOLAH_BERAKHIR",
      },
      { status: 402 },
    );
  }
  if (access.reason === "alumni") {
    return NextResponse.json(
      {
        error:
          "Kamu sudah ditandai lulus dari sekolah ini, jadi kursi sekolah tidak berlaku lagi untuk try out baru. Kamu bisa lanjut belajar dengan paket pribadi di menu Langganan. Riwayat dan nilaimu tetap bisa dibuka.",
        code: "ALUMNI",
      },
      { status: 402 },
    );
  }
  if (access.reason === "sekolah_belum_mulai") {
    return NextResponse.json(
      {
        error: `Langganan sekolahmu baru mulai berlaku pada ${formatWIBDate(access.mulai)}. Kamu bisa mulai try out setelah tanggal itu.`,
        code: "SEKOLAH_BELUM_MULAI",
      },
      { status: 402 },
    );
  }
  if (access.reason === "waiting_for_seat") {
    return NextResponse.json(
      {
        error:
          "Kuota kursi sekolahmu sedang penuh. Begitu admin pusat menambah kuota, kamu otomatis bisa mulai try out lagi - tidak perlu mendaftar ulang.",
        code: "WAITING_FOR_SEAT",
      },
      { status: 402 },
    );
  }
  return NextResponse.json({ error: quotaRequiredMessage, code: "QUOTA_REQUIRED" }, { status: 402 });
}

// POST handler bisa memanggil finalizeAttempt (saat expired) yang, di mode
// Analisis AI "langsung" (default), memicu Gemini via after() - lihat catatan
// di app/api/siswa/attempts/[id]/submit/route.ts.
export const maxDuration = 300;

const startAttemptSchema = z
  .object({
    assignmentId: z.string().uuid().optional(),
    packageId: z.string().uuid().optional(),
    // Bagian D/G (permintaan user): opt-in Learning Analytics untuk try out
    // mandiri - diabaikan untuk Try Out Nasional (selalu true, dibundel) -
    // lihat resolusi lengkapnya di bawah.
    gunakanLearningAnalytics: z.boolean().optional(),
  })
  .refine((d) => [d.assignmentId, d.packageId].filter(Boolean).length === 1, {
    message: "Isi salah satu: assignmentId atau packageId.",
  });

/**
 * Tiket 5.6: riwayat - semua attempt siswa sepanjang waktu (bukan cuma
 * yang terbaru per paket seperti di /api/siswa/ujian), tetap bisa dibuka
 * kapan saja. Tidak ada pengecekan status langganan di sini secara
 * sengaja - riwayat harus tetap terbuka meski akun mandiri kedaluwarsa
 * (Bagian 7.1 brief), cuma mulai attempt baru yang boleh terkunci.
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

  const attempts = await prisma.attempt.findMany({
    where: { studentId: student.id },
    orderBy: { mulaiAt: "desc" },
    include: {
      package: { select: { nama: true } },
    },
  });

  // "Percobaan ke-N" per paket (lihat lib/exam/percobaan.ts) - dihitung dari SEMUA attempt
  // siswa ini (bukan cuma satu halaman), jadi nomornya tetap benar walau riwayat dipaginasi.
  const nomorPercobaan = nomorPercobaanById(attempts);

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      paketNama: a.package.nama,
      percobaanKe: nomorPercobaan.get(a.id) ?? 1,
      terjadwal: a.assignmentId != null,
      status: a.status,
      skorAkhir: a.skorAkhir,
      mulaiAt: a.mulaiAt,
      selesaiAt: a.selesaiAt,
    })),
  });
}

/**
 * Tiket 4.3/4.4: mulai atau lanjutkan attempt. Attempt "berjalan" yang
 * belum kedaluwarsa untuk assignment/paket yang sama langsung
 * dikembalikan (resume alami saat refresh halaman) alih-alih membuat
 * baru - mencegah siswa membuka banyak attempt paralel untuk penugasan
 * yang sama.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = startAttemptSchema.safeParse(body);
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

  let assignment = null as Awaited<ReturnType<typeof getActiveAssignmentsFor>>[number] | null;
  let chosenPackage = null as Awaited<ReturnType<typeof getSelfSelectPackagesFor>>[number] | null;

  if (parsed.data.assignmentId) {
    const active = await getActiveAssignmentsFor(student);
    assignment = active.find((a) => a.id === parsed.data.assignmentId) ?? null;
    if (!assignment) {
      return NextResponse.json(
        { error: "Ujian tidak ditemukan atau jendela waktunya sudah tutup." },
        { status: 404 },
      );
    }

    const fullPkg = await prisma.package.findUnique({
      where: { id: assignment.packageId },
      select: { subjectId: true },
    });
    if (fullPkg) {
      const access = await canStartAttempt(student.id, fullPkg.subjectId, student.schoolId);
      if (!access.allowed) {
        return accessDeniedResponse(access, "Kuota try out untuk mata pelajaran ini sudah habis. Hubungi admin sekolahmu.");
      }
    }
  } else {
    const options = await getSelfSelectPackagesFor(student, { includeUpcoming: true });
    chosenPackage = options.find((p) => p.id === parsed.data.packageId) ?? null;
    if (!chosenPackage) {
      return NextResponse.json(
        { error: "Paket tidak ditemukan atau tidak tersedia untukmu." },
        { status: 404 },
      );
    }

    if (chosenPackage.bukaMulai && new Date(chosenPackage.bukaMulai) > new Date()) {
      return NextResponse.json(
        {
          error: `Paket ini belum dibuka. Ujian baru bisa diakses mulai ${formatWIBHariTanggalJam(chosenPackage.bukaMulai)}.`,
          code: "BELUM_DIBUKA",
        },
        { status: 403 },
      );
    }

    if (chosenPackage.bukaSelesai && new Date(chosenPackage.bukaSelesai) < new Date()) {
      return NextResponse.json(
        {
          error: "Periode ujian untuk paket ini telah berakhir.",
          code: "TELAH_BERAKHIR",
        },
        { status: 403 },
      );
    }

    const access = await canStartAttempt(student.id, chosenPackage.subjectId, student.schoolId);
    if (!access.allowed) {
      return accessDeniedResponse(
        access,
        "Kamu belum memiliki akses try out untuk mata pelajaran ini. Beli paket untuk membuka akses.",
      );
    }

    // Seri Try Out Mandiri: paket terbuka sesuai jadwal global (06.00 WIB per urutan)
    // DAN siswa harus sudah menyelesaikan urutan sebelumnya - lihat
    // lib/exam/seri-mandiri.ts. Paket dengan urutanSeri kosong tidak kena gerbang
    // ini (statusSeriMandiri langsung {terkunci:false}).
    const statusSeri = await statusSeriMandiri(
      student.id,
      { id: chosenPackage.id, subjectId: chosenPackage.subjectId, urutanSeri: chosenPackage.urutanSeri },
      options.filter((p) => p.subjectId === chosenPackage!.subjectId && p.kategori === "mandiri"),
    );
    if (statusSeri.terkunci) {
      return NextResponse.json(
        {
          error:
            statusSeri.alasan === "belum_giliran"
              ? `Selesaikan dulu "${statusSeri.namaPaketSebelumnya}" sebelum mengerjakan paket ini.`
              : `Paket ini dijadwalkan terbuka ${formatWIBHariTanggalJam(statusSeri.bukaPada)}.${
                  statusSeri.prasyarat ? ` Selesaikan juga "${statusSeri.prasyarat}" terlebih dahulu.` : ""
                }`,
          code: "PAKET_TERKUNCI",
        },
        { status: 409 },
      );
    }
  }

  const existing = await prisma.attempt.findFirst({
    where: assignment
      ? { studentId: student.id, assignmentId: assignment.id }
      : { studentId: student.id, packageId: chosenPackage!.id, assignmentId: null },
    orderBy: { mulaiAt: "desc" },
  });

  if (existing && (existing.status === "berjalan" || existing.status === "paused")) {
    if (existing.status === "paused") {
      return NextResponse.json(
        { error: "Sesi ujian ini sedang dijeda admin sekolah. Hubungi admin untuk melanjutkan." },
        { status: 409 },
      );
    }
    if (!isExpired(existing)) {
      return NextResponse.json({ attempt: sanitizeAttemptForClient(existing) });
    }
    await finalizeAttempt(null, existing.id, "kedaluwarsa");
  }

  const packageId = assignment ? assignment.packageId : chosenPackage!.id;
  const fullPackage = await prisma.package.findUniqueOrThrow({
    where: { id: packageId },
    include: { questions: { where: { deletedAt: null } } },
  });

  if (fullPackage.maxAttempt != null) {
    const finishedCount = await prisma.attempt.count({
      where: assignment
        ? { studentId: student.id, assignmentId: assignment.id, status: { in: ["selesai", "kedaluwarsa"] } }
        : {
            studentId: student.id,
            packageId: fullPackage.id,
            assignmentId: null,
            status: { in: ["selesai", "kedaluwarsa"] },
          },
    });
    if (finishedCount >= fullPackage.maxAttempt) {
      return NextResponse.json(
        { error: "Kesempatan mengerjakan paket ini sudah habis." },
        { status: 409 },
      );
    }
  }

  // Bagian D/G (permintaan user): resolusi "gunakan Learning Analytics?"
  // SEBELUM attempt dibuat, supaya siswa langsung tahu kalau saldonya tidak
  // cukup (bukan kaget setelah selesai ujian). Sengaja lewat entitlement
  // school_seat (Jalur A) diperlakukan seperti perilaku lama - AI selalu
  // otomatis termasuk tanpa jatah per-mapel/saldo, karena sekolah sudah bayar
  // borongan di luar sistem ini.
  // Hanya entitlement yang MASIH berlaku sekarang yang dihitung (getActiveEntitlement
  // juga mengembalikan yang sudah berakhir, untuk keperluan riwayat). Selaras dengan
  // wasAttemptFreeTrial: langganan yang sudah habis = diperlakukan sebagai paket gratis.
  const semuaEntitlement = await getActiveEntitlement(student.id);
  const activeEntitlement = semuaEntitlement?.canStartNewAttempt ? semuaEntitlement : null;
  const isSchoolSeat = activeEntitlement?.entitlement.source === "school_seat";
  const hasIndividualEntitlement = activeEntitlement != null && !isSchoolSeat;

  let analisisAiDiminta = false;
  if (fullPackage.kategori === "nasional") {
    if (!activeEntitlement) {
      return NextResponse.json(
        { error: "Try Out Nasional adalah fasilitas berlangganan - berlangganan dulu untuk mengikutinya.", code: "PERLU_LANGGANAN" },
        { status: 402 },
      );
    }
    analisisAiDiminta = true; // Try Out Nasional otomatis termasuk Learning Analytics (Bagian G)
    if (hasIndividualEntitlement) {
      const nasionalStatus = await getTryOutNasionalKuotaRemaining(student.id, fullPackage.subjectId);
      if (!nasionalStatus.usedEventIds.has(fullPackage.id) && nasionalStatus.sisa <= 0) {
        return NextResponse.json(
          {
            error: `Jatah Try Out Nasional untuk mata pelajaran ini sudah habis (${nasionalStatus.total}x per masa aktif langgananmu).`,
            code: "NASIONAL_QUOTA_HABIS",
          },
          { status: 402 },
        );
      }
    }
  } else if (parsed.data.gunakanLearningAnalytics === true) {
    // Paket gratis (tanpa langganan aktif) kini juga boleh beli LA lewat saldo -
    // lihat lib/billing/learning-analytics.ts untuk aturan lengkapnya.
    const tipe: TipeAkses = isSchoolSeat ? "sekolah" : hasIndividualEntitlement ? "langganan" : "gratis";
    const kuota = tipe === "langganan" ? await getAiKuotaRemaining(student.id, fullPackage.subjectId) : null;
    const butuhSaldo = tipe === "gratis" || (tipe === "langganan" && !(kuota && kuota.sisa > 0));
    const [saldo, harga] = butuhSaldo
      ? await Promise.all([getSaldo(student.id), getHargaLearningAnalytics()])
      : [0, 0];

    const putusan = putuskanLearningAnalytics({ tipe, kuotaSisa: kuota?.sisa ?? null, saldo, harga });
    if (!putusan.diminta) {
      return NextResponse.json(
        {
          error:
            tipe === "gratis"
              ? `Saldo kreditmu belum cukup untuk mengaktifkan Learning Analytics (butuh ${formatRupiah(putusan.harga)}, saldo kamu ${formatRupiah(putusan.saldo)}). Tambah / Top Up kredit dulu di halaman Wallet, atau matikan pilihan Learning Analytics untuk lanjut mengerjakan.`
              : `Jatah Learning Analytics gratis mata pelajaran ini sudah habis dan saldomu tidak cukup (butuh ${formatRupiah(putusan.harga)}, saldo kamu ${formatRupiah(putusan.saldo)}). Isi saldo dulu di halaman Wallet.`,
          code: "SALDO_TIDAK_CUKUP",
        },
        { status: 402 },
      );
    }
    analisisAiDiminta = true;
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent");

  const attempt = await prisma.$transaction(async (tx) => {
    const created = await tx.attempt.create({
      data: {
        studentId: student.id,
        packageId: fullPackage.id,
        assignmentId: assignment?.id ?? null,
        mulaiAt: new Date(),
        sisaDetik: fullPackage.durasiMenit * 60,
        status: "berjalan",
        analisisAiDiminta,
        ip,
        userAgent,
      },
    });

    await tx.attemptAnswer.createMany({
      data: fullPackage.questions.map((q) => ({
        attemptId: created.id,
        questionId: q.id,
        skorMaks: q.bobot,
      })),
    });

    return created;
  });

  await logAudit({
    userId: user.id,
    aksi: "create",
    entitas: "attempts",
    entitasId: attempt.id,
    after: attempt,
    ip,
  });
  return NextResponse.json({ attempt: sanitizeAttemptForClient(attempt) }, { status: 201 });
}
