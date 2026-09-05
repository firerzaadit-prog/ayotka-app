import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole, type CurrentUser } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";
import { runAnalisisAi } from "@/lib/ai/analyze";
import { isProcessing, tryStartProcessing, finishProcessing, setLastError } from "@/lib/ai/analysis-guard";
import { PROMPT_VERSION } from "@/lib/ai/version";
import type { Attempt } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET di bawah ini di-poll berkala oleh AnalisisAiPanel buat cek status
 * terbaru - no-store eksplisit di response supaya CDN/proxy di depan
 * Vercel (kalau ada, mis. lewat domain custom ayotka.id) tidak pernah
 * menyimpan snapshot lama. Fetch di client sudah cache:"no-store" juga,
 * tapi itu cuma kontrol sisi browser - header response ini yang menutup
 * kemungkinan cache di layer manapun di antara server dan browser.
 */
function noStoreJson(body: unknown, status?: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function loadAttemptForAdmin(user: CurrentUser, attemptId: string): Promise<Attempt | null> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { student: true },
  });
  if (!attempt) return null;
  if (user.role === "admin_pusat") return attempt;
  const schoolId = await resolveSchoolId(user, null);
  return schoolId && attempt.student.schoolId === schoolId ? attempt : null;
}

/**
 * Tiket 5.3 (keputusan user): analisis AI dipicu manual oleh admin pusat
 * atau admin sekolah lewat tombol - bukan otomatis untuk setiap attempt
 * selesai (jadi cost AI terkendali, sekolah/pusat yang pilih siswa mana
 * yang perlu dianalisis). Proses AI-nya sendiri tetap tidak memblokir:
 * endpoint ini langsung balas "processing" dan pemanggilan Gemini (yang
 * bisa retry sampai puluhan detik) jalan di background.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("admin_sekolah", "admin_pusat");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const attempt = await loadAttemptForAdmin(user, id);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt tidak ditemukan." }, { status: 404 });
  }
  if (attempt.status !== "selesai" && attempt.status !== "kedaluwarsa") {
    return NextResponse.json({ error: "Ujian belum selesai, belum bisa dianalisis." }, { status: 400 });
  }

  if (!(await tryStartProcessing(id))) {
    return NextResponse.json({ status: "processing" });
  }

  // next/server after(): cara resmi Next.js untuk kerja di background
  // setelah respons terkirim - tidak menahan admin menunggu Gemini (bisa
  // retry sampai puluhan detik), dan tetap didukung baik di server
  // Node.js biasa maupun (lewat waitUntil) di platform serverless.
  after(async () => {
    try {
      await runAnalisisAi(attempt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[analisis-ai] gagal untuk attempt ${id}:`, err);
      await setLastError(id, message);
    } finally {
      await finishProcessing(id);
    }
  });

  return NextResponse.json({ status: "processing" });
}

/** Status/hasil analisis - siswa pemilik attempt, admin sekolahnya, atau admin pusat. */
export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa", "admin_sekolah", "admin_pusat");
  } catch {
    return noStoreJson({ error: "Tidak diizinkan." }, 403);
  }

  const { id } = await params;
  const attempt =
    user.role === "siswa" ? await loadOwnedAttempt(user.id, id) : await loadAttemptForAdmin(user, id);
  if (!attempt) {
    return noStoreJson({ error: "Attempt tidak ditemukan." }, 404);
  }

  const analysis = await prisma.aiAnalysis.findUnique({ where: { attemptId: id } });
  if (analysis) {
    return noStoreJson({
      status: "ready",
      analysis: analysis.detailJson,
      generatedAt: analysis.generatedAt,
      // Tandai kalau hasil ini dibuat dengan versi prompt lama (lihat
      // lib/ai/version.ts) - UI bisa menyarankan "Analisis ulang" tanpa
      // siswa/admin perlu menebak dari tanggalnya saja.
      outdated: analysis.versiPrompt !== PROMPT_VERSION,
    });
  }
  if (isProcessing(attempt.aiAnalysisProcessingAt)) {
    return noStoreJson({ status: "processing" });
  }
  if (attempt.aiAnalysisLastError) {
    // Teks error asli (bisa berisi detail internal/upstream Gemini) cuma
    // relevan buat admin yang punya tombol "Analisis ulang" - siswa cukup
    // tahu belum tersedia. AnalisisAiPanel di client sudah menyaring ini
    // lewat prop canTrigger, tapi itu cuma kontrol tampilan; body response
    // ini sendiri harus sudah bersih sebelum sampai ke browser siswa.
    return noStoreJson({
      status: "error",
      error: user.role === "siswa" ? "Analisis belum tersedia, coba lagi nanti." : attempt.aiAnalysisLastError,
    });
  }
  return noStoreJson({ status: "none" });
}
