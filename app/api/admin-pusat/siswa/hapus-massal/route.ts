import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { buatPenghapusAkunLogin, hapusSiswaMassal, ringkasanAuditHapus } from "@/lib/students/hapus";
import { studentHapusMassalSchema } from "@/lib/validations/student";

/**
 * Admin pusat menghapus banyak pengguna siswa sekaligus (kotak centang di Semua Siswa), Jalur A maupun Jalur B.
 * Aturan per siswa sama persis dengan DELETE /api/admin-pusat/siswa/[id] (lib/students/hapus.ts). Siswa yang sudah
 * tidak ada / sudah dihapus dihitung di `tidakDitemukan`. Email akun masing-masing dicatat di audit log.
 */
export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = studentHapusMassalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }
  const ids = [...new Set(parsed.data.ids)];

  const boleh = await prisma.student.findMany({ where: { id: { in: ids }, deletedAt: null } });
  const tidakDitemukan = ids.length - boleh.length;
  // Email akun dibaca sebelum akunnya dihapus, untuk catatan audit.
  const idAkun = boleh.map((s) => s.userId).filter((id): id is string => id != null);
  const akun = idAkun.length ? await prisma.user.findMany({ where: { id: { in: idAkun } }, select: { id: true, email: true } }) : [];
  const emailPerAkun = new Map(akun.map((a) => [a.id, a.email]));

  const hasil = await hapusSiswaMassal(
    { db: prisma, hapusAkunLogin: buatPenghapusAkunLogin(createAdminClient()) },
    boleh,
  );

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
          userId: admin.id,
          aksi: "delete",
          entitas: "students",
          entitasId: s.id,
          before: { ...s, email: (s.userId ? emailPerAkun.get(s.userId) : null) ?? null },
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
