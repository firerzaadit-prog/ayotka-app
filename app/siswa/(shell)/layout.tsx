import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { pilihNamaAkun } from "@/lib/auth/nama-akun";
import { getKeanggotaanSiswa } from "@/lib/billing/keanggotaan";
import { formatWIBDate } from "@/lib/utils/datetime";
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
    select: { id: true, nama: true, jalur: true, schoolId: true, deletedAt: true, lulusAt: true, school: { select: { nama: true } } },
  });
  const title =
    student?.jalur === "B"
      ? "Siswa (Mandiri)"
      : student?.school
        ? `Siswa ${student.school.nama} (Kerja Sama)`
        : "Siswa";

  // Lencana keanggotaan di pojok kanan atas: Member Gratis / Bulanan / Semester (/ Sekolah untuk siswa Jalur A yang
  // ditanggung sekolah). Tanpa profil siswa tidak ada lencana.
  const keanggotaan = student ? await getKeanggotaanSiswa(student) : null;

  return (
    <DashboardShell
      title={title}
      akun={pilihNamaAkun(user.email, student?.nama)}
      akunDetail={user.email}
      akunHref="/siswa/profil"
      lencana={
        keanggotaan
          ? {
              jenis: keanggotaan.jenis,
              label: keanggotaan.label,
              keterangan: keanggotaan.berlakuSampai
                ? `Berlaku sampai ${formatWIBDate(keanggotaan.berlakuSampai)}`
                : "Lihat paket langganan",
              href: "/siswa/langganan",
            }
          : undefined
      }
      nav={
        <SidebarSection>
          <SidebarLink href="/siswa/dashboard"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="9" x="3" y="3" rx="1.5" />
                <rect width="7" height="5" x="14" y="3" rx="1.5" />
                <rect width="7" height="9" x="14" y="12" rx="1.5" />
                <rect width="7" height="5" x="3" y="16" rx="1.5" />
              </svg>
            }
          >
            Dashboard
          </SidebarLink>
          {student?.jalur === "A" && (
            <SidebarLink href="/siswa/ujian?kategori=sekolah"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
                </svg>
              }
            >
              Try Out Sekolah
            </SidebarLink>
          )}
          <SidebarLink href="/siswa/ujian?kategori=nasional"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3a14.5 14.5 0 0 0 0 18M12 3a14.5 14.5 0 0 1 0 18M3 12h18" />
              </svg>
            }
          >
            Try Out Nasional
          </SidebarLink>
          <SidebarLink href="/siswa/ujian?kategori=mandiri"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11.5 11 13.5 15.5 9M12 3l7 3v5c0 4.6-3 8.7-7 10-4-1.3-7-5.4-7-10V6l7-3Z" />
              </svg>
            }
          >
            Try Out Mandiri
          </SidebarLink>
          <SidebarLink href="/siswa/riwayat"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 2M21 12a9 9 0 1 1-9-9c2.5 0 4.7 1 6.3 2.7M21 3v4.5h-4.5" />
              </svg>
            }
          >
            Riwayat
          </SidebarLink>
          <SidebarLink href="/siswa/langganan"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 1 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 1 1 0-4V7a2 2 0 0 0-2-2H5z" />
              </svg>
            }
          >
            Langganan &amp; Voucher
          </SidebarLink>
          <SidebarLink href="/siswa/wallet"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
              </svg>
            }
          >
            Wallet / Saldo
          </SidebarLink>
          <SidebarLink href="/siswa/pembayaran"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" />
              </svg>
            }
          >
            Riwayat Pembayaran
          </SidebarLink>
          <SidebarLink href="/siswa/profil"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            }
          >
            Profil Saya
          </SidebarLink>
        </SidebarSection>
      }
    >
      {children}
    </DashboardShell>
  );
}
