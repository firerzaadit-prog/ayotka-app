import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { buildHasil } from "@/lib/exam/hasil";
import { ringkasKesiapanSiswa } from "@/lib/analytics/kesiapan";
import { RiwayatSiswaView } from "@/components/siswa/riwayat-siswa-view";

export default async function DetailSiswaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin_pusat");
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

  if (!student) {
    notFound();
  }

  // buildHasil() = sumber data yang sama persis dipakai endpoint rapor PDF
  // (app/api/siswa/attempts/[id]/rapor) - dipanggil di sini juga supaya admin
  // bisa lihat rincian jawaban langsung di web, bukan cuma lewat unduh PDF.
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
      backHref="/admin-pusat/siswa"
      backLabel="Kembali ke Daftar Siswa"
    />
  );
}
