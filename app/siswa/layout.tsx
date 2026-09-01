import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarSection, SidebarLink } from "@/components/layout/sidebar-nav";

export const dynamic = "force-dynamic";

export default async function SiswaLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "siswa") {
    redirect("/api/auth/force-logout?next=/login");
  }

  // Subtitle sidebar - tegaskan status pendaftaran siswa di setiap halaman
  // (bukan cuma di halaman Langganan) supaya selalu terlihat itu akun Jalur
  // A sekolah mana, atau memang siswa mandiri.
  const student = await prisma.student.findFirst({
    where: { userId: user.id },
    select: { jalur: true, school: { select: { nama: true } } },
  });
  const title =
    student?.jalur === "B"
      ? "Siswa (Mandiri)"
      : student?.school
        ? `Siswa ${student.school.nama} (Kerja Sama)`
        : "Siswa";

  return (
    <DashboardShell
      title={title}
      email={user.email}
      nav={
        <SidebarSection>
          <SidebarLink href="/siswa/dashboard">Dashboard</SidebarLink>
          <SidebarLink href="/siswa/ujian">Ujian</SidebarLink>
          <SidebarLink href="/siswa/riwayat">Riwayat</SidebarLink>
          <SidebarLink href="/siswa/langganan">Langganan</SidebarLink>
        </SidebarSection>
      }
    >
      {children}
    </DashboardShell>
  );
}
