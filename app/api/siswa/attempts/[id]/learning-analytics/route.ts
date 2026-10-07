import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { hitungOpsiLaSusulan } from "@/lib/billing/la-susulan";
import { tryStartProcessing } from "@/lib/ai/analysis-guard";
import { prosesSatuAnalisis } from "@/lib/ai/queue-worker";

// Pemanggilan Gemini (bisa retry puluhan detik) berjalan di after() setelah respons terkirim - sama seperti
// app/api/attempts/[id]/analisis-ai.
export const maxDuration = 300;

type RouteParams = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

/** Opsi Learning Analytics susulan untuk satu percobaan milik siswa (harga, saldo, jatah) - hanya membaca. */
export async function GET(_request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }
  const { id } = await params;
  const attempt = await loadOwnedAttempt(user.id, id);
  if (!attempt) return json({ error: "Attempt tidak ditemukan." }, 404);
  return json({ opsi: await hitungOpsiLaSusulan(attempt) });
}

/**
 * Siswa menjalankan Learning Analytics SETELAH ujian selesai, untuk percobaan yang tidak mengaktifkannya saat mulai.
 * Dibayar dengan aturan yang sama persis dengan pemrosesnya (lib/billing/pendanaan-la.ts): jatah paket dulu, saldo
 * sesudahnya. Saldo TIDAK didebit di sini - pendebitan terjadi di pemroses tepat sebelum analisis dijalankan, dan
 * dikembalikan penuh bila analisisnya gagal. Di sini hanya pemeriksaan awal supaya siswa langsung tahu kalau saldonya
 * kurang (dan diarahkan mengisi saldo) alih-alih menunggu lalu melihat tidak ada hasil.
 */
export async function POST(request: Request, { params }: RouteParams) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }

  const { id } = await params;
  const attempt = await loadOwnedAttempt(user.id, id);
  if (!attempt) return json({ error: "Attempt tidak ditemukan." }, 404);

  if (!checkRateLimit(`la-susulan:${attempt.id}`, 5, 60_000)) {
    return json({ error: "Terlalu banyak permintaan, coba lagi sebentar lagi." }, 429);
  }

  const opsi = await hitungOpsiLaSusulan(attempt);
  if (!opsi.tersedia) {
    // Idempoten: klik ganda, tab kedua, atau analisis yang sudah jadi tidak membuat apa pun dua kali.
    if (opsi.alasan === "sudah_ada") return json({ status: "ready" });
    if (opsi.alasan === "sedang_diproses") return json({ status: "processing" });
    if (opsi.alasan === "nasional") {
      return json({ error: "Try Out Nasional sudah termasuk Learning Analytics otomatis.", code: "NASIONAL" }, 409);
    }
    return json({ error: "Ujian belum selesai, belum bisa dianalisis.", code: "BELUM_SELESAI" }, 409);
  }
  if (opsi.pendanaan === "kuota" && opsi.batasTercapai) {
    return json(
      {
        error: `Batas Learning Analytics untuk mata pelajaran ini sudah tercapai (${opsi.batasMaks} kali).`,
        code: "BATAS_TERCAPAI",
      },
      409,
    );
  }
  if (opsi.pendanaan === "saldo" && !opsi.cukup) {
    return json(
      {
        error: `Saldo kamu ${formatRupiah(opsi.saldo)}, butuh ${formatRupiah(opsi.harga)} (kurang ${formatRupiah(opsi.kurang)}). Isi saldo dulu.`,
        code: "SALDO_TIDAK_CUKUP",
        harga: opsi.harga,
        saldo: opsi.saldo,
        kurang: opsi.kurang,
      },
      402,
    );
  }

  // Tandai bahwa percobaan ini kini memakai Learning Analytics: dipakai rapor PDF dan halaman admin untuk memutuskan
  // apakah analisisnya ikut ditampilkan. Bersyarat (hanya bila masih false) supaya klik ganda aman.
  await prisma.attempt.updateMany({ where: { id: attempt.id, analisisAiDiminta: false }, data: { analisisAiDiminta: true } });

  // Klaim atomik: hanya satu pemrosesan per percobaan (klik ganda / dua tab).
  if (!(await tryStartProcessing(attempt.id))) return json({ status: "processing" });

  after(async () => {
    await prosesSatuAnalisis(attempt.id);
  });

  await logAudit({
    userId: user.id,
    aksi: "update",
    entitas: "attempts",
    entitasId: attempt.id,
    after: { learningAnalyticsSusulan: true, pendanaan: opsi.pendanaan },
    ip: getClientIp(request),
  });
  return json({ status: "processing" });
}
