import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Alert } from "@/components/ui/alert";
import { buttonClassName } from "@/components/ui/button";
import { IconLink } from "@/components/ui/empty-state-icons";
import { KesiapanCard } from "@/components/ui/kesiapan-breakdown";
import { buildKesiapanSekolah } from "@/lib/analytics/sekolah";

export const dynamic = "force-dynamic";

export default async function AdminSekolahDashboardPage() {
  const user = await requireRole("admin_sekolah");
  const schoolId = await resolveSchoolId(user, null);

  if (!schoolId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Dashboard Admin Sekolah" />
        <EmptyState
          icon={<IconLink />}
          title="Akun belum terhubung ke sekolah"
          description="Hubungi Admin Pusat untuk menghubungkan akun ini ke sebuah sekolah."
        />
      </div>
    );
  }

  const [school, activeYear] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.academicYear.findFirst({ where: { isActive: true } }),
  ]);

  const [siswaAktif, belumKlaim, rombel, paketSoal, kesiapan] = await Promise.all([
    prisma.student.count({ where: { schoolId, jalur: "A", deletedAt: null } }),
    prisma.student.count({
      where: { schoolId, jalur: "A", deletedAt: null, claimStatus: "belum_klaim" },
    }),
    activeYear
      ? prisma.class.count({ where: { schoolId, academicYearId: activeYear.id } })
      : Promise.resolve(0),
    prisma.package.count({
      where: { ownerType: "sekolah", ownerId: schoolId, status: { not: "archived" } },
    }),
    buildKesiapanSekolah(schoolId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard Admin Sekolah" description={school?.nama} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Siswa aktif" value={siswaAktif} />
        <StatCard label="Rombel (tahun ajaran aktif)" value={rombel} />
        <StatCard label="Siswa belum klaim akun" value={belumKlaim} />
        <StatCard label="Paket soal" value={paketSoal} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">Kesiapan TKA</h2>
          <Link href="/admin-sekolah/analitik" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Lihat rincian per mapel &rarr;
          </Link>
        </div>
        <KesiapanCard title="Kesiapan sekolah (gabungan)" breakdown={kesiapan.gabungan} />
      </div>

      {!activeYear && (
        <Alert variant="warning">
          Belum ada tahun ajaran aktif — hubungi Admin Pusat untuk mengaktifkan salah satu tahun
          ajaran sebelum mengelola rombel.
        </Alert>
      )}

      {belumKlaim > 0 && (
        <Alert variant="info">
          Ada {belumKlaim} siswa yang belum mengklaim akunnya — cetak kartu kode klaim dari
          halaman Kelas untuk dibagikan.
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/admin-sekolah/kelas" className={buttonClassName("primary")}>
          Kelola Kelas
        </Link>
        <Link href="/admin-sekolah/siswa" className={buttonClassName("secondary")}>
          Kelola Siswa
        </Link>
        <Link href="/admin-sekolah/bank-soal" className={buttonClassName("secondary")}>
          Bank Soal
        </Link>
      </div>
    </div>
  );
}
