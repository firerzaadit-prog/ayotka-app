import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { loadOwnedAttempt, sanitizeAttemptForClient } from "@/lib/exam/attempt-access";
import { getRemainingSeconds } from "@/lib/exam/timing";
import { checkAndClaimSession } from "@/lib/exam/session-guard";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Penyegaran RINGAN halaman ujian (tiap 20 detik per siswa): hanya status, sisa
 * waktu server, dan jawaban tersimpan - TANPA soal. Dulu penyegaran memanggil
 * GET /api/siswa/attempts/[id] yang memuat ulang seluruh soal + pilihan
 * jawaban setiap kali; untuk ribuan siswa serentak itu ratusan permintaan
 * berat per detik dan puluhan GB egress per ujian. Soal cukup diambil sekali
 * saat halaman dibuka.
 *
 * Guard-nya sama persis dengan GET utama: kepemilikan + lazy-expiry
 * (loadOwnedAttempt) dan satu sesi aktif per ujian (checkAndClaimSession).
 * Sama seperti GET utama, kunci jawaban tidak pernah dikirim: yang kembali
 * hanya jawaban siswa itu sendiri.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const { id } = await params;
  const attempt = await loadOwnedAttempt(user.id, id);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt tidak ditemukan." }, { status: 404 });
  }

  // Dijeda / selesai / kedaluwarsa: cukup status - klien yang memutuskan (tampilan jeda atau pindah ke hasil).
  if (attempt.status !== "berjalan") {
    return NextResponse.json({ attempt: sanitizeAttemptForClient(attempt), answers: [] });
  }

  const tabToken = request.nextUrl.searchParams.get("tabToken");
  if (!tabToken) {
    return NextResponse.json({ error: "tabToken wajib diisi." }, { status: 400 });
  }
  if (!(await checkAndClaimSession(attempt.id, tabToken))) {
    return NextResponse.json(
      { error: "SESI_DIAMBIL_ALIH", message: "Ujian ini sedang dibuka di tab/perangkat lain." },
      { status: 409 },
    );
  }

  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, jawabanJson: true, ragu: true },
  });

  return NextResponse.json(
    {
      attempt: { ...sanitizeAttemptForClient(attempt), sisaDetik: getRemainingSeconds(attempt) },
      answers,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
