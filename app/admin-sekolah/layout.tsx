import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { prisma } from "@/lib/db/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarSection, SidebarLink } from "@/components/layout/sidebar-nav";
import { ActingAsSchoolBanner } from "@/components/layout/acting-as-school-banner";

export const dynamic = "force-dynamic";

export default async function AdminSekolahLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin_sekolah" && user.role !== "admin_pusat")) {
    redirect("/api/auth/force-logout?next=/login");
  }

  // Mode "Kelola Sekolah": admin pusat memakai halaman admin sekolah yang
  // sama persis, cuma dibungkus dengan banner supaya jelas sekolah mana yang
  // sedang dikelola. Tanpa sekolah terpilih (cookie belum di-set / sudah
  // kedaluwarsa), tidak ada gunanya masuk ke sini - balikkan ke daftar
  // sekolah untuk pilih dulu.
  let banner: React.ReactNode = null;
  if (user.role === "admin_pusat") {
    const schoolId = await resolveSchoolId(user, null);
    const school = schoolId
      ? await prisma.school.findUnique({ where: { id: schoolId }, select: { nama: true } })
      : null;
    if (!school) {
      redirect("/admin-pusat/sekolah");
    }
    banner = <ActingAsSchoolBanner schoolName={school.nama} />;
  }

  return (
    <DashboardShell
      title="Admin Sekolah"
      email={user.email}
      banner={banner}
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
