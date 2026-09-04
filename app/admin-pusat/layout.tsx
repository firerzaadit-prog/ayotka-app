import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SidebarSection, SidebarLink } from "@/components/layout/sidebar-nav";

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
    redirect("/api/auth/force-logout?next=/login");
  }

  return (
    <DashboardShell
      title="Admin Pusat"
      email={user.email}
      nav={
        <>
          <SidebarSection>
            <SidebarLink href="/admin-pusat/dashboard">Dashboard</SidebarLink>
          </SidebarSection>

          <SidebarSection label="Sekolah & Siswa">
            <SidebarLink href="/admin-pusat/sekolah">Sekolah</SidebarLink>
            <SidebarLink href="/admin-pusat/tahun-ajaran">Tahun Ajaran</SidebarLink>
            <SidebarLink href="/admin-pusat/siswa">Semua Siswa</SidebarLink>
            <SidebarLink href="/admin-pusat/siswa-mandiri">Siswa Mandiri</SidebarLink>
            <SidebarLink href="/admin-pusat/siswa/pindah">Pindah Sekolah</SidebarLink>
            <SidebarLink href="/admin-pusat/verifikasi-sekolah">Verifikasi Sekolah</SidebarLink>
            <SidebarLink href="/admin-pusat/dinas-pendidikan">Dinas Pendidikan</SidebarLink>
          </SidebarSection>

          <SidebarSection label="Bank Soal">
            <SidebarLink href="/admin-pusat/taxonomy">Taxonomy</SidebarLink>
            <SidebarLink href="/admin-pusat/kisi-kisi">Kisi-kisi</SidebarLink>
            <SidebarLink href="/admin-pusat/bank-soal">Bank Soal</SidebarLink>
          </SidebarSection>

          <SidebarSection label="Ujian">
            <SidebarLink href="/admin-pusat/jadwal-ujian">Jadwal Ujian</SidebarLink>
            <SidebarLink href="/admin-pusat/pelanggaran-ujian">Pelanggaran Ujian</SidebarLink>
          </SidebarSection>

          <SidebarSection label="Monetisasi">
            <SidebarLink href="/admin-pusat/langganan">Paket Layanan</SidebarLink>
            <SidebarLink href="/admin-pusat/verifikasi-tryout-mapel">
              Verifikasi Try Out Mapel
            </SidebarLink>
            <SidebarLink href="/admin-pusat/pendapatan">Pendapatan</SidebarLink>
          </SidebarSection>

          <SidebarSection label="Monitoring">
            <SidebarLink href="/admin-pusat/analitik">Analitik Global</SidebarLink>
            <SidebarLink href="/admin-pusat/sesi">Sesi Aktif</SidebarLink>
            <SidebarLink href="/admin-pusat/audit-log">Audit Log</SidebarLink>
          </SidebarSection>
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}
