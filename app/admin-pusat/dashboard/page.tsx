import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";

const QUICK_LINKS = [
  {
    href: "/admin-pusat/sekolah",
    title: "Sekolah",
    description: "Kelola daftar sekolah & akun admin sekolah.",
  },
  {
    href: "/admin-pusat/bank-soal",
    title: "Bank Soal",
    description: "Kelola paket soal & kisi-kisi ujian.",
  },
  {
    href: "/admin-pusat/jadwal-ujian",
    title: "Jadwal Ujian",
    description: "Pantau jadwal ujian lintas sekolah.",
  },
  {
    href: "/admin-pusat/langganan",
    title: "Langganan",
    description: "Kelola paket & langganan sekolah.",
  },
  {
    href: "/admin-pusat/analitik",
    title: "Analitik Global",
    description: "Lihat performa siswa lintas sekolah.",
  },
  {
    href: "/admin-pusat/audit-log",
    title: "Audit Log",
    description: "Riwayat aktivitas admin di seluruh sistem.",
  },
];

export default async function AdminPusatDashboardPage() {
  const [totalSekolah, totalAdminSekolah] = await Promise.all([
    prisma.school.count(),
    prisma.schoolUser.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard Admin Pusat"
        description="Ringkasan seluruh jaringan sekolah AyoTKA."
      />

      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <StatCard label="Total sekolah" value={totalSekolah} />
        <StatCard label="Total akun admin sekolah" value={totalAdminSekolah} />
      </div>

      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Akses cepat
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <Card className="h-full transition-all group-hover:border-indigo-200 group-hover:shadow-md">
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{item.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
