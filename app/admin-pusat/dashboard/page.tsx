import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { periodeBulanWIB } from "@/lib/utils/datetime";

function formatRupiahRingkas(n: number): string {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`;
  return `Rp${n}`;
}

function empatPuluhHariLalu(): Date {
  return new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
}

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
  const periodeIni = periodeBulanWIB();

  const [
    totalSekolah,
    totalAdminSekolah,
    totalSiswaAktif,
    totalUjianSelesai,
    sekolahMenungguVerifikasi,
    orderBulanTerakhir,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.schoolUser.count(),
    prisma.student.count({ where: { status: "active", deletedAt: null } }),
    prisma.attempt.count({ where: { status: "selesai" } }),
    prisma.school.count({ where: { status: "pending_verifikasi" } }),
    // Batas 40 hari cukup menjangkau seluruh tanggal periode bulan berjalan
    // di zona WIB, dan disaring lagi persis via periodeBulanWIB (bukan batas
    // UTC mentah) supaya batas bulan konsisten dengan /api/admin-pusat/pendapatan.
    prisma.subjectTryOutOrder.findMany({
      where: { status: "disetujui", disetujuiAt: { gte: empatPuluhHariLalu() } },
      select: { jumlah: true, disetujuiAt: true },
    }),
  ]);
  const pendapatanBulanIni = orderBulanTerakhir
    .filter((o) => o.disetujuiAt && periodeBulanWIB(o.disetujuiAt) === periodeIni)
    .reduce((sum, o) => sum + o.jumlah, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard Admin Pusat"
        description="Ringkasan seluruh jaringan sekolah AyoTKA."
      />

      {sekolahMenungguVerifikasi > 0 && (
        <Alert variant="warning">
          Ada {sekolahMenungguVerifikasi} sekolah menunggu verifikasi —{" "}
          <Link href="/admin-pusat/verifikasi-sekolah" className="font-medium underline">
            tinjau sekarang
          </Link>
          .
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total sekolah" value={totalSekolah} />
        <StatCard label="Total akun admin sekolah" value={totalAdminSekolah} />
        <StatCard label="Siswa aktif" value={totalSiswaAktif} />
        <StatCard label="Ujian selesai (semua waktu)" value={totalUjianSelesai} />
        <StatCard label="Pendapatan bulan ini" value={formatRupiahRingkas(pendapatanBulanIni)} />
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
