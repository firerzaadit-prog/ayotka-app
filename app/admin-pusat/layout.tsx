import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

// Halaman di bawah section ini selalu bergantung sesi login per pengguna -
// jangan pernah di-prerender statis saat build.
export const dynamic = "force-dynamic";

export default async function AdminPusatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin_pusat") {
    redirect("/login");
  }

  return (
    <DashboardShell
      title="Admin Pusat"
      email={user.email}
      nav={
        <nav className="flex gap-4 text-sm text-slate-600">
          <Link href="/admin-pusat/dashboard" className="hover:text-slate-900">
            Dashboard
          </Link>
          <Link href="/admin-pusat/sekolah" className="hover:text-slate-900">
            Sekolah
          </Link>
          <Link href="/admin-pusat/taxonomy" className="hover:text-slate-900">
            Taxonomy
          </Link>
          <Link href="/admin-pusat/bank-soal" className="hover:text-slate-900">
            Bank Soal
          </Link>
        </nav>
      }
    >
      {children}
    </DashboardShell>
  );
}
