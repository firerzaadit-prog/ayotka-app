import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { loadOwnedAttempt } from "@/lib/exam/attempt-access";
import { HARI_SIMPAN_RIWAYAT } from "@/lib/tutor/konstanta";
import { bersihkanBilaPerlu, hapusPercakapan, muatRiwayat } from "@/lib/tutor/penyimpanan";

type RouteParams = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Pemilik percakapan dan soalnya, selalu dari SESI (bukan dari isi permintaan): hanya siswa pemilik percobaan yang lolos,
 * dan id soal harus UUID. Mengembalikan Response galat bila ada yang gagal.
 */
async function pemilikDanSoal(request: Request, params: RouteParams["params"]) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return json({ error: "Tidak diizinkan." }, 403);
  }

  const { id } = await params;
  const attempt = await loadOwnedAttempt(user.id, id);
  if (!attempt) return json({ error: "Attempt tidak ditemukan." }, 404);

  const questionId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("questionId"));
  if (!questionId.success) return json({ error: "Soal tidak valid.", code: "DATA_TIDAK_VALID" }, 400);

  return { attempt, questionId: questionId.data };
}

/**
 * Percakapan Tanya Tutor AI milik siswa untuk SATU soal pada percobaannya sendiri, yang belum lewat 7 hari (isinya
 * dihapus otomatis sesudah itu - lib/tutor/penyimpanan.ts). Hanya siswa pemilik percobaan yang bisa membacanya; tidak ada
 * halaman admin yang menampilkan isi percakapan. Foto tidak pernah disimpan, hanya penanda `adaFoto`.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const pemilik = await pemilikDanSoal(request, params);
  if (pemilik instanceof Response) return pemilik;

  bersihkanBilaPerlu();
  const pesan = await muatRiwayat({
    attemptId: pemilik.attempt.id,
    studentId: pemilik.attempt.studentId,
    questionId: pemilik.questionId,
  });
  return json({ pesan, hariSimpan: HARI_SIMPAN_RIWAYAT });
}

/**
 * Siswa menghapus percakapannya untuk satu soal sebelum 7 hari berakhir. Hanya isinya yang dikosongkan; jatah pesan
 * harian TIDAK kembali (lihat hapusPercakapan).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const pemilik = await pemilikDanSoal(request, params);
  if (pemilik instanceof Response) return pemilik;

  const dihapus = await hapusPercakapan({
    attemptId: pemilik.attempt.id,
    studentId: pemilik.attempt.studentId,
    questionId: pemilik.questionId,
  });
  return json({ dihapus });
}
