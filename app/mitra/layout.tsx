import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarSection, SidebarLink } from "@/components/layout/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function MitraLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "mitra") {
    redirect("/api/auth/force-logout?next=/admin/mitra");
  }

  return (
    <DashboardShell
      title="Mitra"
      email={user.email}
      nav={
        <SidebarSection>
          <SidebarLink href="/mitra/dashboard">Voucher Saya</SidebarLink>
        </SidebarSection>
      }
    >
      {children}
    </DashboardShell>
  );
}
