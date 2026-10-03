import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { muatSiswaKelolaanMassal } from "@/lib/students/kelolaan";
import { createAdminClient } from "@/lib/supabase/admin";
import { buatPenghapusAkunLogin, hapusSiswaMassal, ringkasanAuditHapus } from "@/lib/students/hapus";
import { studentHapusMassalSchema } from "@/lib/validations/student";

/**
 * Hapus banyak siswa sekaligus (kotak centang di halaman Kelola Siswa). Aturannya sama persis dengan
 * hapus satu siswa (lib/students/hapus.ts): akun login dihapus, siswa tanpa riwayat dihapus permanen,
 * siswa dengan riwayat diarsipkan dan NISN-nya dibebaskan.
 *
 * Siswa yang tidak ditemukan / sudah dihapus / milik sekolah lain tidak diproses dan dihitung di
 * `tidakDitemukan` (admin sekolah tidak bisa menyentuh siswa sekolah lain walau ID-nya dikirim).
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = studentHapusMassalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }
  const ids = [...new Set(parsed.data.ids)];

  // Hanya Jalur A milik sekolah yang berhak; otorisasi dicek sekali per sekolah (lihat lib/students/kelolaan.ts).
  const { boleh, tidakDitemukan } = await muatSiswaKelolaanMassal(user, ids);

  const hasil = await hapusSiswaMassal(
    { db: prisma, hapusAkunLogin: buatPenghapusAkunLogin(createAdminClient()) },
    boleh,
  );

  // Jejak audit per siswa (sama seperti hapus satu-satu): before memuat NISN asli.
  const modePerSiswa = new Map<string, "permanen" | "arsip">([
    ...hasil.permanen.map((id) => [id, "permanen"] as const),
    ...hasil.arsip.map((id) => [id, "arsip"] as const),
  ]);
  const ip = getClientIp(request);
  const diproses = boleh.filter((s) => modePerSiswa.has(s.id));
  for (let i = 0; i < diproses.length; i += 20) {
    await Promise.all(
      diproses.slice(i, i + 20).map((s) =>
        logAudit({
          userId: user.id,
          aksi: "delete",
          entitas: "students",
          entitasId: s.id,
          before: s,
          after: ringkasanAuditHapus(modePerSiswa.get(s.id)!),
          ip,
        }),
      ),
    );
  }

  return NextResponse.json({
    dihapus: hasil.permanen.length,
    diarsipkan: hasil.arsip.length,
    gagal: hasil.gagal.length,
    tidakDitemukan,
  });
}
