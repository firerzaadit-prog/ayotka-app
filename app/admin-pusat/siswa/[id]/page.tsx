import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { buildHasil } from "@/lib/exam/hasil";
import { ringkasKesiapanSiswa } from "@/lib/analytics/kesiapan";
import { getKeanggotaanSiswa } from "@/lib/billing/keanggotaan";
import { adalahEmailSintetis } from "@/lib/billing/pembayaran-affiliate";
import { getSaldo } from "@/lib/billing/saldo";
import { siswaDenganRiwayat } from "@/lib/students/hapus";
import { ringkasEmailKontak } from "@/lib/siswa/email-kontak";
import { formatWIBDate } from "@/lib/utils/datetime";
import { RiwayatSiswaView } from "@/components/siswa/riwayat-siswa-view";
import { ProfilSiswaAdminCard } from "@/components/admin/profil-siswa-admin";
import { TombolHapusSiswa } from "@/components/admin/tombol-hapus-siswa";

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

  // Profil pengguna + keputusan tombol Hapus: akun login, keanggotaan, saldo, dan apakah siswa punya riwayat (diarsipkan
  // bila ya, dihapus permanen bila tidak - aturan yang sama dengan lib/students/hapus.ts).
  const [akun, keanggotaan, saldo, punyaRiwayat] = await Promise.all([
    student.userId
      ? prisma.user.findUnique({ where: { id: student.userId }, select: { email: true, lastLoginAt: true } })
      : Promise.resolve(null),
    getKeanggotaanSiswa(student),
    getSaldo(student.id),
    siswaDenganRiwayat(prisma, [student.id]),
  ]);

  return (
    <RiwayatSiswaView
      student={student}
      kesiapanPerMapel={kesiapanPerMapel}
      hasilByAttempt={hasilByAttempt}
      backHref="/admin-pusat/siswa"
      backLabel="Kembali ke Daftar Siswa"
      profilSlot={
        <ProfilSiswaAdminCard
          profil={{
            nama: student.nama,
            email: akun && !adalahEmailSintetis(akun.email) ? akun.email : null,
            punyaAkun: akun !== null,
            nisn: student.nisn,
            jenjang: student.jenjang,
            jalur: student.jalur,
            sekolah: student.school
              ? { nama: student.school.nama, kabupatenKota: student.school.kabupatenKota, statusSekolah: student.school.statusSekolah }
              : null,
            status: student.status,
            claimStatus: student.claimStatus,
            lulusAt: student.lulusAt ? student.lulusAt.toISOString() : null,
            waKontak: student.waKontak,
            emailKontak: ringkasEmailKontak(student),
            terakhirMasuk: akun?.lastLoginAt ? akun.lastLoginAt.toISOString() : null,
            keanggotaan,
            saldo,
            jumlahPercobaan: student.attempts.length,
            jumlahSelesai: student.attempts.filter((a) => a.status === "selesai").length,
          }}
          aksi={
            // Siswa yang sudah dihapus (arsip) tidak bisa dihapus lagi.
            student.deletedAt ? (
              <span className="text-xs font-medium text-slate-500" data-siswa-arsip>
                Pengguna ini sudah dihapus (arsip).
              </span>
            ) : (
              <TombolHapusSiswa
                id={student.id}
                nama={student.nama}
                jalur={student.jalur}
                adaRiwayat={punyaRiwayat.has(student.id)}
                kembaliKe="/admin-pusat/siswa"
                peringatan={
                  keanggotaan.jenis === "bulanan" || keanggotaan.jenis === "semester"
                    ? `Pengguna ini masih berlangganan (${keanggotaan.label}${keanggotaan.berlakuSampai ? `, sampai ${formatWIBDate(keanggotaan.berlakuSampai)}` : ""}); paketnya ikut tidak bisa dipakai.`
                    : undefined
                }
              />
            )
          }
        />
      }
    />
  );
}
