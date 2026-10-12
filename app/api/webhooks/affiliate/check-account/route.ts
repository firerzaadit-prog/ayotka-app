import { prisma } from "@/lib/db/prisma";
import { getClientIp } from "@/lib/audit/log";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  affiliateCorsResponse,
  affiliateJsonResponse,
  affiliateTolak,
  parseAffiliatePayload,
} from "@/lib/billing/affiliate-cors";
import { periksaAksesAffiliate } from "@/lib/billing/affiliate-auth";

export async function OPTIONS() {
  return affiliateCorsResponse();
}

/**
 * Check Account/Slug Endpoint untuk affiliate.id (Gambar 4).
 * Request: POST { "uid": "uid_user_kamu" }
 * Response(200):
 * {
 *   "status": true,
 *   "data": {
 *     "uid": "user_uid",
 *     "aid": [
 *       {
 *         "aid": "student_id",
 *         "title": "student_nama",
 *         "slug": "student_id"
 *       }
 *     ]
 *   }
 * }
 */
export async function POST(request: Request) {
  const akses = periksaAksesAffiliate(request);
  if (!akses.ok) {
    console.warn(`[affiliate check-account] ditolak (${akses.status}): rahasia tidak ada atau salah`);
    return affiliateTolak(akses);
  }
  // Juga dibatasi lajunya: endpoint ini menjawab apakah sebuah email/akun ada, jadi tidak boleh bisa disapu.
  if (!checkRateLimit(`affiliate-check-account:${getClientIp(request) ?? "unknown"}`, 60, 60_000)) {
    return affiliateJsonResponse({ status: false, message: "Terlalu banyak permintaan." }, 429);
  }
  try {
    const data = await parseAffiliatePayload(request);
    const uidRaw = (data.uid as string) || (data.userId as string);
    const uid = typeof uidRaw === "string" ? uidRaw.trim() : null;

    if (!uid) {
      return affiliateJsonResponse(
        { status: false, message: "Field uid wajib disertakan." },
        400,
      );
    }

    const student = await prisma.student.findFirst({
      where: {
        userId: uid,
        deletedAt: null,
      },
      select: { id: true, nama: true },
    });

    if (!student) {
      return affiliateJsonResponse({
        status: false,
        message: "Profil siswa tidak ditemukan untuk uid tersebut.",
        data: null,
      });
    }

    return affiliateJsonResponse({
      status: true,
      data: {
        uid,
        aid: [
          {
            aid: student.id,
            title: student.nama,
            slug: student.id,
          },
        ],
      },
    });
  } catch (error) {
    console.error("[affiliate check-account error]:", error);
    return affiliateJsonResponse(
      { status: false, message: "Terjadi kesalahan internal server." },
      500,
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
