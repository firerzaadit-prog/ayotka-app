import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { buildHasil } from "@/lib/exam/hasil";
import { ringkasKesiapanSiswa } from "@/lib/analytics/kesiapan";
import { RiwayatSiswaView } from "@/components/siswa/riwayat-siswa-view";
import { getDinasWilayah, siswaDalamWilayahDinas } from "@/lib/dinas/wilayah";

/**
 * Detail riwayat siswa untuk dinas pendidikan - akses baca saja lintas
 * sekolah DALAM WILAYAHNYA (kota/kabupaten yang ditetapkan admin pusat; sama
 * seperti daftar dan analitik dinas), canTrigger=false supaya tombol
 * "Analisis ulang" AI (aksi tulis) tidak muncul di role ini. Siswa di luar
 * wilayah, siswa mandiri (Jalur B), dan siswa yang sudah dihapus tampil
 * sebagai "tidak ditemukan" - ID tidak boleh dipakai untuk mengintip data
 * wilayah lain.
 */
export default async function DetailSiswaDinasPendidikanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("dinas_pendidikan");
  const { id } = await params;
  const wilayah = await getDinasWilayah(user.id);

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

  if (!student || !siswaDalamWilayahDinas(student, wilayah)) {
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
