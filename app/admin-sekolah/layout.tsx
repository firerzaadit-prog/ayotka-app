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
    redirect("/login");
  }

  return (
    <DashboardShell title="Admin Sekolah" email={user.email}>
      {children}
    </DashboardShell>
  );
}
