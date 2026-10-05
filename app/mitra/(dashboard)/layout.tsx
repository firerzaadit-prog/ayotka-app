import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getNamaAkun } from "@/lib/auth/nama-akun";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarSection, SidebarLink } from "@/components/layout/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function MitraLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "mitra") {
    redirect("/api/auth/force-logout?next=/mitra/login");
  }

  const akun = await getNamaAkun(user);

  return (
    <DashboardShell
      title="Mitra"
      akun={akun}
      akunDetail={user.email}
      nav={
        <SidebarSection>
          <SidebarLink href="/mitra/dashboard">Voucher Saya</SidebarLink>
          <SidebarLink href="/mitra/beli-voucher">Beli Voucher</SidebarLink>
        </SidebarSection>
      }
    >
      {children}
    </DashboardShell>
  );
}
