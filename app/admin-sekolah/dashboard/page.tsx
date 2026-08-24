import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function AdminSekolahDashboardPage() {
  const user = await requireRole("admin_sekolah");
  const schoolId = await resolveSchoolId(user, null);

  if (!schoolId) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard Admin Sekolah</h1>
        <EmptyState
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

  const [siswaAktif, belumKlaim, rombel, paketSoal] = await Promise.all([
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
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard Admin Sekolah</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Siswa aktif</p>
          <p className="text-2xl font-semibold text-slate-900">
            {siswaAktif}
            <span className="text-base font-normal text-slate-400">
              /{school?.kuotaSiswa ?? 0}
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Rombel (tahun ajaran aktif)</p>
          <p className="text-2xl font-semibold text-slate-900">{rombel}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Siswa belum klaim akun</p>
          <p className="text-2xl font-semibold text-slate-900">{belumKlaim}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Paket soal</p>
          <p className="text-2xl font-semibold text-slate-900">{paketSoal}</p>
        </div>
      </div>

      {!activeYear && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Belum ada tahun ajaran aktif — hubungi Admin Pusat untuk mengaktifkan salah satu tahun
          ajaran sebelum mengelola rombel.
        </p>
      )}

      {belumKlaim > 0 && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Ada {belumKlaim} siswa yang belum mengklaim akunnya — cetak kartu kode klaim dari
          halaman Kelas untuk dibagikan.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin-sekolah/kelas"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Kelola Kelas
        </Link>
        <Link
          href="/admin-sekolah/siswa"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Kelola Siswa
        </Link>
        <Link
          href="/admin-sekolah/bank-soal"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Bank Soal
        </Link>
      </div>
    </div>
  );
}
