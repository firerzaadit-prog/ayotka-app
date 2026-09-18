import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getActiveAssignmentsFor, getSelfSelectPackagesFor, getSelfSelectTryOutGroupsFor } from "@/lib/exam/visibility";
import { getActiveEntitlement } from "@/lib/billing/entitlements";
import { parsePlanFitur } from "@/lib/billing/plan-fitur";

/** Tiket 4.4 (Bagian 3.2 brief): daftar ujian terjadwal (Mode A) + paket latihan mandiri (Mode B). */
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

  // Bagian B/C (permintaan user): Jalur A (sekolah) kini juga dapat akses
  // Try Out Mandiri & Nasional selain Ujian Terjadwal, sesuai konfirmasi klien.
  const isJalurA = student.jalur === "A";

  const [assignments, packages, tryOutGroups, attempts, activeEntitlement] = await Promise.all([
    isJalurA ? getActiveAssignmentsFor(student) : Promise.resolve([]),
    getSelfSelectPackagesFor(student),
    getSelfSelectTryOutGroupsFor(student),
    prisma.attempt.findMany({
      where: { studentId: student.id },
      select: {
        id: true,
        assignmentId: true,
        packageId: true,
        status: true,
        skorAkhir: true,
        mulaiAt: true,
        package: { select: { tryOutGroupId: true } },
      },
      orderBy: { mulaiAt: "desc" },
    }),
    getActiveEntitlement(student.id),
  ]);

  let activePlan: { kode: string; nama: string; aiKuotaPerMapel: number; tryOutNasionalKuotaPerMapel: number } | null = null;
  if (activeEntitlement) {
    const plan = await prisma.plan.findUnique({ where: { id: activeEntitlement.entitlement.planId } });
    if (plan) {
      const fitur = parsePlanFitur(plan.fitur);
      const isSchool = activeEntitlement.entitlement.source === "school_seat" || plan.kode === "school";
      activePlan = {
        kode: plan.kode,
        nama: isSchool ? "Sekolah & Lembaga (Setara Semester)" : plan.nama,
        aiKuotaPerMapel: fitur.aiKuotaPerMapel,
        tryOutNasionalKuotaPerMapel: isSchool
          ? (fitur.tryOutNasionalKuotaPerMapel > 0 ? fitur.tryOutNasionalKuotaPerMapel : 3)
          : fitur.tryOutNasionalKuotaPerMapel,
      };
    }
  }

  return NextResponse.json({
    jalur: student.jalur,
    jenjang: student.jenjang,
    tingkat: student.tingkat,
    activePlan,
    assignments,
    // Sertakan field "kategori" di packages & tryOutGroups supaya UI bisa
    // memisahkan menu "Try Out Nasional" dan "Try Out Mandiri" tanpa
    // re-fetch tambahan.
    packages: packages.map((p) => ({
      id: p.id,
      nama: p.nama,
      jumlahSoal: p.jumlahSoal,
      durasiMenit: p.durasiMenit,
      jenisPaket: p.jenisPaket,
      kategori: p.kategori,
      bukaSelesai: p.bukaSelesai,
      bukaMulai: p.bukaMulai,
      subject: p.subject,
    })),
    tryOutGroups: tryOutGroups.map((g) => ({
      id: g.id,
      nama: g.nama,
      jumlahSoal: g.jumlahSoal,
      durasiMenit: g.durasiMenit,
      kategori: g.kategori,
      bukaSelesai: g.bukaSelesai,
      bukaMulai: g.bukaMulai,
      subject: g.subject,
    })),
    attempts: attempts.map((a) => ({
      id: a.id,
      assignmentId: a.assignmentId,
      packageId: a.packageId,
      tryOutGroupId: a.package.tryOutGroupId,
      status: a.status,
      skorAkhir: a.skorAkhir,
      mulaiAt: a.mulaiAt,
    })),
  });
}

