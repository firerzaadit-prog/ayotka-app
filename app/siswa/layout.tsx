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
    <DashboardShell title="Siswa" email={user.email}>
      {children}
    </DashboardShell>
  );
}
