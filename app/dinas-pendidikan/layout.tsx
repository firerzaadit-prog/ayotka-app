import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarSection, SidebarLink } from "@/components/layout/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function DinasPendidikanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "dinas_pendidikan") {
    redirect("/api/auth/force-logout?next=/login");
  }

  return (
    <DashboardShell
      title="Dinas Pendidikan"
      email={user.email}
      nav={
        <SidebarSection>
          <SidebarLink href="/dinas-pendidikan/dashboard">Kesiapan TKA</SidebarLink>
          <SidebarLink href="/dinas-pendidikan/analitik">Analitik Global</SidebarLink>
        </SidebarSection>
      }
    >
      {children}
    </DashboardShell>
  );
}
