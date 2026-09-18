import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { RankingWidget } from "@/components/dashboard/ranking-widget";
import { VoucherRedeemCard } from "@/components/siswa/voucher-redeem-card";

const QUICK_LINKS = [
  {
    href: "/siswa/ujian?kategori=nasional",
    id: "link-tryout-nasional",
    title: "Try Out Nasional",
    description: "Try Out resmi terjadwal bersama siswa se-Indonesia. Analisis AI Learning Analytics otomatis termasuk.",
    badge: "Terjadwal",
    badgeColor: "bg-violet-100 text-violet-700",
    iconColor: "bg-violet-50 text-violet-600",
    icon: (
      <path
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/siswa/ujian?kategori=mandiri",
    id: "link-tryout-mandiri",
    title: "Try Out Mandiri",
    description: "Latihan kapan saja dan sepuasnya sesuai tingkat dan mata pelajaranmu.",
    badge: "Buka 24 jam",
    badgeColor: "bg-indigo-100 text-indigo-700",
    iconColor: "bg-indigo-50 text-indigo-600",
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
    id: "link-riwayat",
    title: "Riwayat",
    description: "Lihat nilai dan pembahasan dari ujian yang sudah kamu kerjakan.",
    badge: null,
    badgeColor: "",
    iconColor: "bg-slate-50 text-slate-600",
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
    id: "link-langganan",
    title: "Langganan",
    description: "Kelola langganan paket belajarmu.",
    badge: null,
    badgeColor: "",
    iconColor: "bg-slate-50 text-slate-600",
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((item) => (
          <Link key={item.href} href={item.href} id={item.id} className="group">
            <Card className="relative h-full transition-all group-hover:border-indigo-200 group-hover:shadow-md">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${item.iconColor}`}>
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  {item.icon}
                </svg>
              </div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                {item.badge && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      <VoucherRedeemCard />

      <RankingWidget />
    </div>
  );
}

