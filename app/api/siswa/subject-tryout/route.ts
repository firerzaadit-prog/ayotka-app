import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { listActiveServicePackages } from "@/lib/billing/subject-tryout";

/**
 * Bagian 7.3 brief: daftar mata pelajaran (sesuai jenjang siswa) untuk
 * dipilih di halaman checkout paket try out, plus kuota yang sudah dimiliki
 * per mapel supaya siswa tahu berapa sisa try out-nya sebelum beli lagi.
 * Sekarang juga mengembalikan daftar paket layanan aktif (dikonfigurasi
 * admin pusat) supaya siswa bisa memilih paket yang sesuai.
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
  if (student.jalur !== "B") {
    return NextResponse.json({ jalur: "A" as const });
  }

  const [subjects, quotas, servicePackages] = await Promise.all([
    prisma.subject.findMany({ where: { jenjang: student.jenjang }, orderBy: { nama: "asc" } }),
    prisma.subjectTryOutQuota.findMany({ where: { userId: user.id } }),
    listActiveServicePackages(),
  ]);

  const quotaBySubject = new Map(quotas.map((q) => [q.subjectId, q]));

  return NextResponse.json({
    jalur: "B" as const,
    servicePackages: servicePackages.map((p) => ({
      id: p.id,
      nama: p.nama,
      hargaPerMapel: p.hargaPerMapel,
      tryOutPerMapel: p.tryOutPerMapel,
      deskripsi: p.deskripsi,
    })),
    subjects: subjects.map((s) => {
      const quota = quotaBySubject.get(s.id);
      return {
        id: s.id,
        nama: s.nama,
        sisaTryOut: quota ? Math.max(0, quota.total - quota.terpakai) : 0,
        totalTryOut: quota?.total ?? 0,
      };
    }),
  });
}
