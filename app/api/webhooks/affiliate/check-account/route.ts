import { prisma } from "@/lib/db/prisma";
import {
  affiliateCorsResponse,
  affiliateJsonResponse,
  parseAffiliatePayload,
} from "@/lib/billing/affiliate-cors";

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
