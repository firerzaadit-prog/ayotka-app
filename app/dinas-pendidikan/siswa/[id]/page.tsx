import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { buildHasil } from "@/lib/exam/hasil";
import { ringkasKesiapanSiswa } from "@/lib/analytics/kesiapan";
import { RiwayatSiswaView } from "@/components/siswa/riwayat-siswa-view";

/**
 * Detail riwayat siswa untuk dinas pendidikan - akses baca saja lintas
 * sekolah (tidak dibatasi satu sekolah seperti admin sekolah, sama seperti
 * halaman Kesiapan TKA Antar Sekolah), canTrigger=false supaya tombol
 * "Analisis ulang" AI (aksi tulis) tidak muncul di role ini.
 */
export default async function DetailSiswaDinasPendidikanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("dinas_pendidikan");
  const { id } = await params;

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

  if (!student || student.deletedAt) {
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
      backHref="/dinas-pendidikan/dashboard"
      backLabel="Kembali ke Kesiapan TKA Antar Sekolah"
      canTrigger={false}
    />
  );
}
