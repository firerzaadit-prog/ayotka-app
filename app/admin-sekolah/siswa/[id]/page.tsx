import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { resolveSchoolId } from "@/lib/schools/scope";
import { notFound } from "next/navigation";
import { buildHasil } from "@/lib/exam/hasil";
import { ringkasKesiapanSiswa } from "@/lib/analytics/kesiapan";
import { RiwayatSiswaView } from "@/components/siswa/riwayat-siswa-view";

/** admin_pusat juga diizinkan lewat mode "Kelola Sekolah" (schoolId dari cookie acting-as-school). */
export default async function DetailSiswaAdminSekolahPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("admin_sekolah", "admin_pusat");
  const { id } = await params;

  const schoolId = await resolveSchoolId(user, null);
  if (!schoolId) {
    notFound();
  }

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      school: true,
      attempts: {
        orderBy: { mulaiAt: "desc" },
        include: { package: { include: { subject: true } } },
      },
    },
  });

  if (!student || student.deletedAt || student.schoolId !== schoolId) {
    notFound();
  }

  const hasilByAttempt = new Map(
    await Promise.all(
      student.attempts
        .filter((a) => a.status === "selesai")
        .map(async (a) => [a.id, await buildHasil(a)] as const),
    ),
  );

  const kesiapanPerMapel = ringkasKesiapanSiswa(
    student.attempts
      .filter(
        (a): a is typeof a & { skorAkhir: number } =>
          (a.status === "selesai" || a.status === "kedaluwarsa") && a.skorAkhir != null,
      )
      .map((a) => ({ subjectNama: a.package.subject.nama, skorAkhir: a.skorAkhir })),
  );

  return (
    <RiwayatSiswaView
      student={student}
      kesiapanPerMapel={kesiapanPerMapel}
      hasilByAttempt={hasilByAttempt}
      backHref="/admin-sekolah/siswa"
      backLabel="Kembali ke Daftar Siswa"
      canTrigger={true}
    />
  );
}
