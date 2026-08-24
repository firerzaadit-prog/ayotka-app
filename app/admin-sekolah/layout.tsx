import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function AdminSekolahLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin_sekolah") {
    redirect("/api/auth/force-logout?next=/login");
  }

  return (
    <DashboardShell
      title="Admin Sekolah"
      email={user.email}
      nav={
        <nav className="flex gap-4 text-sm text-slate-600">
          <Link href="/admin-sekolah/dashboard" className="hover:text-slate-900">
            Dashboard
          </Link>
          <Link href="/admin-sekolah/kelas" className="hover:text-slate-900">
            Kelas
          </Link>
          <Link href="/admin-sekolah/siswa" className="hover:text-slate-900">
            Siswa
          </Link>
          <Link href="/admin-sekolah/ujian" className="hover:text-slate-900">
            Ujian
          </Link>
          <Link href="/admin-sekolah/bank-soal" className="hover:text-slate-900">
            Bank Soal
          </Link>
        </nav>
      }
    >
      {children}
    </DashboardShell>
  );
}
