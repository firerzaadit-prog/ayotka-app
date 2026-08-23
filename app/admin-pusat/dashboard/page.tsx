import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function AdminPusatDashboardPage() {
  const [totalSekolah, totalAdminSekolah] = await Promise.all([
    prisma.school.count(),
    prisma.schoolUser.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard Admin Pusat</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total sekolah</p>
          <p className="text-2xl font-semibold text-slate-900">{totalSekolah}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total akun admin sekolah</p>
          <p className="text-2xl font-semibold text-slate-900">{totalAdminSekolah}</p>
        </div>
      </div>

      <Link
        href="/admin-pusat/sekolah"
        className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Kelola sekolah
      </Link>
    </div>
  );
}
