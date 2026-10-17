import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buatPenghapusAkunLogin,
  GagalHapusAkunLoginError,
  hapusSiswa,
  ringkasanAuditHapus,
} from "@/lib/students/hapus";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Admin pusat menghapus satu pengguna siswa - Jalur A (sekolah) MAUPUN Jalur B (mandiri). Rute admin sekolah
 * (/api/admin-sekolah/siswa/[id]) sengaja hanya melayani Jalur A milik sekolahnya: siswa mandiri adalah pelanggan
 * sendiri, hanya pemilik platform yang boleh menghapusnya.
 *
 * Aturannya sama dengan hapus siswa biasa (lib/students/hapus.ts): akun login dihapus (emailnya bebas dipakai lagi),
 * siswa tanpa riwayat dihapus permanen, siswa yang punya riwayat ujian/pembayaran/saldo/langganan diarsipkan
 * (aturan Bagian 7.2 brief: nilai dan transaksi tidak boleh hilang) dengan NISN dan kode klaim dibebaskan. Bila akun
 * login gagal dihapus, tidak ada data yang berubah dan aman diulang. Email akun ikut dicatat di audit log (before)
 * karena setelah dihapus tidak ada lagi tempat lain yang menyimpannya.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  let admin;
  try {
    admin = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const siswa = await prisma.student.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!siswa || siswa.deletedAt) {
    return NextResponse.json({ error: "Siswa tidak ditemukan." }, { status: 404 });
  }
  const { user, ...data } = siswa;

  let mode: "permanen" | "arsip";
  try {
    mode = await hapusSiswa({ db: prisma, hapusAkunLogin: buatPenghapusAkunLogin(createAdminClient()) }, data);
  } catch (error) {
    if (error instanceof GagalHapusAkunLoginError) {
      return NextResponse.json(
        { error: "Gagal menghapus akun login siswa. Tidak ada data yang berubah, silakan coba lagi." },
        { status: 502 },
      );
    }
    throw error;
  }

  await logAudit({
    userId: admin.id,
    aksi: "delete",
    entitas: "students",
    entitasId: id,
    before: { ...data, email: user?.email ?? null },
    after: ringkasanAuditHapus(mode),
    ip: getClientIp(request),
  });

  return NextResponse.json({ ok: true, mode });
}
