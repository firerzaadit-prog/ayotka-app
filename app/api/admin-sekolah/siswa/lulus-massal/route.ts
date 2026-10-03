import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole, type CurrentUser } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { muatSiswaKelolaanMassal } from "@/lib/students/kelolaan";
import { batalkanLulusMassal, tandaiLulusMassal } from "@/lib/students/lulus";
import { assertKuotaTersedia, hitungKursiTerpakai, KuotaPenuhError, kuotaAcuanSekolah } from "@/lib/students/create";
import { studentLulusMassalSchema } from "@/lib/validations/student";

/**
 * Tandai lulus (lulus: true) atau batalkan tanda lulus (lulus: false) untuk banyak siswa sekaligus. Alumni TETAP
 * ada (login, riwayat, nilai, dan analitik sekolah) tetapi tidak memakan kursi sekolah - lihat lib/students/lulus.ts.
 * Hanya siswa Jalur A milik sekolah yang berhak (lib/students/kelolaan.ts); yang lain dihitung `tidakDitemukan`.
 */
export async function POST(request: Request) {
  let user: CurrentUser;
  try {
    user = await requireRole("admin_pusat", "admin_sekolah");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = studentLulusMassalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid." }, { status: 400 });
  }
  const ids = [...new Set(parsed.data.ids)];
  const { boleh, tidakDitemukan } = await muatSiswaKelolaanMassal(user, ids);
  const ip = getClientIp(request);
  const now = new Date();

  async function catatAudit(siswa: typeof boleh, lulus: boolean) {
    for (let i = 0; i < siswa.length; i += 20) {
      await Promise.all(
        siswa.slice(i, i + 20).map((s) =>
          logAudit({
            userId: user.id,
            aksi: "update",
            entitas: "students",
            entitasId: s.id,
            before: { lulusAt: s.lulusAt },
            after: { lulusAt: lulus ? now : null },
            ip,
          }),
        ),
      );
    }
  }

  if (parsed.data.lulus) {
    const hasil = await tandaiLulusMassal(prisma, boleh.map((s) => s.id), now);
    const ditandai = new Set(hasil.ditandai);
    await catatAudit(boleh.filter((s) => ditandai.has(s.id)), true);
    return NextResponse.json({ ditandai: hasil.ditandai.length, dilewati: hasil.dilewati, tidakDitemukan });
  }

  // Membatalkan lulus mengembalikan siswa ke daftar aktif dan MEMAKAN KURSI lagi: kuota dicek per sekolah SEBELUM
  // mengubah apa pun, supaya pembatalan sebagian tidak menembus kuota.
  const alumni = boleh.filter((s) => s.lulusAt);
  const perSekolah = new Map<string, number>();
  for (const s of alumni) perSekolah.set(s.schoolId!, (perSekolah.get(s.schoolId!) ?? 0) + 1);
  try {
    for (const [schoolId, jumlah] of perSekolah) {
      if (user.role === "admin_sekolah") {
        await assertKuotaTersedia(schoolId, jumlah);
      } else {
        // Admin pusat tidak diblokir saat langganan berakhir, tetapi tetap tidak boleh melewati kuota periode.
        const kuota = await kuotaAcuanSekolah(schoolId);
        if (kuota != null && (await hitungKursiTerpakai(schoolId)) + jumlah > kuota) {
          throw new KuotaPenuhError(
            `Kuota sekolah tidak mencukupi untuk memulihkan ${jumlah} siswa. Tambah kuota periode atau tandai lulus siswa lain dulu.`,
          );
        }
      }
    }
  } catch (error) {
    if (error instanceof KuotaPenuhError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const hasil = await batalkanLulusMassal(prisma, boleh.map((s) => s.id));
  const dipulihkan = new Set(hasil.dipulihkan);
  await catatAudit(boleh.filter((s) => dipulihkan.has(s.id)), false);
  return NextResponse.json({ dipulihkan: hasil.dipulihkan.length, dilewati: hasil.dilewati, tidakDitemukan });
}
