import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

const QUICK_LINKS = [
  {
    href: "/siswa/ujian",
    title: "Ujian",
    description: "Kerjakan ujian yang ditugaskan sekolahmu atau paket latihan mandiri.",
    icon: (
      <path
        d="M9 11.5 11 13.5 15.5 9M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/riwayat",
    title: "Riwayat",
    description: "Lihat nilai dan pembahasan dari ujian yang sudah kamu kerjakan.",
    icon: (
      <path
        d="M12 8v4l3 2M21 12a9 9 0 1 1-9-9c2.5 0 4.7 1 6.3 2.7M21 3v4.5h-4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/langganan",
    title: "Langganan",
    description: "Kelola langganan paket latihan mandirimu.",
    icon: (
      <path
        d="M3 8.5h18M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 15.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function SiswaDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard Siswa" description="Selamat datang kembali di AyoTKA." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="h-full transition-all group-hover:border-indigo-200 group-hover:shadow-md">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  {item.icon}
                </svg>
              </div>
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
