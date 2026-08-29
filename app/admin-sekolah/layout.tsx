import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarSection, SidebarLink } from "@/components/layout/sidebar-nav";

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
        <SidebarSection>
          <SidebarLink href="/admin-sekolah/dashboard">Dashboard</SidebarLink>
          <SidebarLink href="/admin-sekolah/kelas">Kelas</SidebarLink>
          <SidebarLink href="/admin-sekolah/siswa">Siswa</SidebarLink>
          <SidebarLink href="/admin-sekolah/ujian">Ujian</SidebarLink>
          <SidebarLink href="/admin-sekolah/analitik">Analitik</SidebarLink>
        </SidebarSection>
      }
    >
      {children}
    </DashboardShell>
  );
}
