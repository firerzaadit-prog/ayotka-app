import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function SiswaLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "siswa") {
    redirect("/api/auth/force-logout?next=/login");
  }

  return (
    <DashboardShell
      title="Siswa"
      email={user.email}
      nav={
        <nav className="flex gap-4 text-sm text-slate-600">
          <Link href="/siswa/dashboard" className="hover:text-slate-900">
            Dashboard
          </Link>
          <Link href="/siswa/ujian" className="hover:text-slate-900">
            Ujian
          </Link>
          <Link href="/siswa/riwayat" className="hover:text-slate-900">
            Riwayat
          </Link>
          <Link href="/siswa/langganan" className="hover:text-slate-900">
            Langganan
          </Link>
        </nav>
      }
    >
      {children}
    </DashboardShell>
  );
}
