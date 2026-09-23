import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Halaman ujian sengaja TIDAK memakai DashboardShell (sidebar Dashboard/Try
 * Out Nasional/dst. + header) seperti halaman siswa lainnya (lihat
 * app/siswa/(shell)/layout.tsx) - siswa yang sedang mengerjakan ujian tidak
 * boleh mudah tergoda navigasi keluar dari layar ujian, dan layar jadi
 * penuh untuk soal. Layout ini cuma menjaga gerbang auth yang sama
 * (redirect kalau bukan siswa) tanpa render shell apa pun - halaman ujian
 * sendiri sudah punya bar judul paket + timer-nya sendiri.
 */
export default async function AttemptLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "siswa") {
    redirect("/api/auth/force-logout?next=/login");
  }

  return <div className="min-h-screen bg-slate-50/70">{children}</div>;
}
