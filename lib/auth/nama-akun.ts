import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { CurrentUser } from "@/lib/auth/session";

/**
 * Label akun di pojok kanan atas semua dashboard (components/layout/dashboard-shell.tsx).
 * Dulu selalu email; sekarang nama yang lebih dikenali pemakainya: nama siswa, nama sekolah (admin sekolah),
 * nama mitra, nama instansi dinas pendidikan. Admin pusat tetap memakai email.
 */

/** Nama pertama yang terisi (setelah dipangkas); email jadi cadangan terakhir supaya label tidak pernah kosong. */
export function pilihNamaAkun(email: string, ...kandidat: (string | null | undefined)[]): string {
  for (const k of kandidat) {
    const t = k?.trim();
    if (t) return t;
  }
  return email;
}

export async function getNamaAkun(user: Pick<CurrentUser, "id" | "email" | "role">): Promise<string> {
  switch (user.role) {
    case "siswa": {
      const siswa = await prisma.student.findFirst({ where: { userId: user.id }, select: { nama: true } });
      return pilihNamaAkun(user.email, siswa?.nama);
    }
    case "admin_sekolah": {
      // Admin sekolah selalu terikat ke satu sekolah (lihat resolveSchoolId di lib/schools/scope.ts).
      const tautan = await prisma.schoolUser.findFirst({
        where: { userId: user.id },
        select: { school: { select: { nama: true } } },
      });
      return pilihNamaAkun(user.email, tautan?.school.nama);
    }
    case "mitra": {
      const mitra = await prisma.partner.findUnique({ where: { userId: user.id }, select: { nama: true } });
      return pilihNamaAkun(user.email, mitra?.nama);
    }
    case "dinas_pendidikan": {
      // "nama" di profil dinas adalah penanggung jawab; yang dikenali sebagai nama dinasnya adalah instansi
      // (mis. "Dinas Pendidikan Kota Malang").
      const dinas = await prisma.dinasAdmin.findUnique({
        where: { userId: user.id },
        select: { instansi: true, nama: true },
      });
      return pilihNamaAkun(user.email, dinas?.instansi, dinas?.nama);
    }
    default:
      return user.email;
  }
}
