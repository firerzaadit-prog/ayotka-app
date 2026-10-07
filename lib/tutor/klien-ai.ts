import "server-only";
import { bersihkanBalasan } from "@/lib/tutor/validasi";
import type { KonteksTutor } from "@/lib/tutor/konteks-soal";
import type { PesanTutor } from "@/lib/tutor/riwayat";

/** Alamat layanan Tutor AI (dijalankan partner di generator soal). Bisa diganti lewat env TUTOR_AI_URL. */
export function urlTutorAi(): string {
  return process.env.TUTOR_AI_URL?.trim() || "https://ai.ayotka.id/api/ai/tutor/chat";
}

const BATAS_WAKTU_MS = 60_000;

export type HasilTutor =
  | { ok: true; balasan: string }
  | { ok: false; alasan: "jaringan" | "waktu_habis" | "http" | "isi_tidak_valid"; status?: number };

/**
 * Panggil layanan Tutor AI dari SERVER (bukan dari peramban siswa): layanan itu terbuka untuk siapa pun (tanpa kunci,
 * CORS terbuka), jadi pembatasan, pemeriksaan siswa, dan penyusunan konteks soal dilakukan di sisi kita.
 * Foto hanya melekat pada pesan siswa TERAKHIR (foto lama tidak dikirim ulang tiap giliran: hemat biaya dan ukuran).
 * Galat dari layanan tidak pernah diteruskan apa adanya ke siswa - hanya alasan ringkas untuk pencatatan.
 */
export async function tanyaTutorAi(input: {
  konteks: KonteksTutor;
  pesan: PesanTutor[];
  gambar?: string;
}): Promise<HasilTutor> {
  const terakhir = input.pesan.length - 1;
  const body = {
    soalContext: input.konteks,
    messages: input.pesan.map((m, i) => ({
      role: m.role,
      content: m.content,
      ...(input.gambar && i === terakhir ? { images: [input.gambar] } : {}),
    })),
  };

  let res: Response;
  try {
    res = await fetch(urlTutorAi(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(BATAS_WAKTU_MS),
    });
  } catch (err) {
    const waktuHabis = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    console.error(`[tutor] layanan tidak terjangkau (${waktuHabis ? "waktu habis" : "jaringan"}):`, err instanceof Error ? err.message : err);
    return { ok: false, alasan: waktuHabis ? "waktu_habis" : "jaringan" };
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    const ringkas = typeof json?.error === "string" ? json.error.slice(0, 200) : "";
    console.error(`[tutor] layanan menjawab ${res.status}${ringkas ? `: ${ringkas}` : ""}`);
    return { ok: false, alasan: "http", status: res.status };
  }
  const balasan = bersihkanBalasan(json?.data?.reply ?? json?.reply);
  if (!balasan) {
    console.error("[tutor] layanan menjawab tanpa isi balasan");
    return { ok: false, alasan: "isi_tidak_valid" };
  }
  return { ok: true, balasan };
}
