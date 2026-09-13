import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { getAiAutoAnalysisSettings, setAiAutoAnalysisMaxPerSubject } from "@/lib/ai/settings";
import { z } from "zod";

/**
 * Daftar Analisis AI Gagal - lintas sekolah, difilter opsional per jalur.
 * aiAnalysisLastError otomatis ter-null-kan begitu attempt itu mulai
 * diproses ulang (lihat lib/ai/analysis-guard.ts:tryStartProcessing), jadi
 * daftar ini sudah dengan sendirinya tidak lagi menampilkan attempt yang
 * sedang/sudah berhasil diproses ulang - tidak perlu flag status terpisah.
 */
export async function GET(request: Request) {
  try {
    await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const url = new URL(request.url);
  const jalurParam = url.searchParams.get("jalur");
  const jalur = jalurParam === "A" || jalurParam === "B" ? jalurParam : undefined;

  const [attempts, settings] = await Promise.all([
    prisma.attempt.findMany({
      where: {
        aiAnalysisLastError: { not: null },
        ...(jalur ? { student: { jalur } } : {}),
      },
      orderBy: { selesaiAt: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        selesaiAt: true,
        aiAnalysisLastError: true,
        student: { select: { nama: true, jalur: true, school: { select: { nama: true } } } },
        package: { select: { nama: true, subject: { select: { nama: true } } } },
      },
    }),
    getAiAutoAnalysisSettings(),
  ]);

  return NextResponse.json({
    attempts: attempts.map((a) => ({
      id: a.id,
      studentNama: a.student.nama,
      jalur: a.student.jalur,
      sekolahNama: a.student.school?.nama ?? "-",
      paketNama: a.package.nama,
      mapelNama: a.package.subject.nama,
      status: a.status,
      selesaiAt: a.selesaiAt,
      error: a.aiAnalysisLastError,
    })),
    maxPerSubject: settings.aiAutoAnalysisMaxPerSubject,
  });
}

const patchSchema = z.object({
  aiAutoAnalysisMaxPerSubject: z.number().int().min(0).max(100),
});

/** Ubah jatah global analisis AI OTOMATIS per siswa per mata pelajaran (lib/ai/auto-trigger.ts). */
export async function PATCH(request: Request) {
  let user;
  try {
    user = await requireRole("admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
      { status: 400 },
    );
  }

  const before = await getAiAutoAnalysisSettings();
  const after = await setAiAutoAnalysisMaxPerSubject(parsed.data.aiAutoAnalysisMaxPerSubject);

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "app_settings",
    entitasId: after.id,
    before,
    after,
    ip: getClientIp(request),
  });

  return NextResponse.json({ maxPerSubject: after.aiAutoAnalysisMaxPerSubject });
}
