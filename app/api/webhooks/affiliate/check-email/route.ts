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
 * Check Email Address Endpoint untuk affiliate.id (Gambar 4).
 * Request: POST { "email": "email@user.com" } (atau form-data / urlencoded / query string)
 *
 * Response jika user ada (200):
 * {
 *   "status": true,
 *   "data": {
 *     "email": "email@user.com",
 *     "uid": "user_uid"
 *   }
 * }
 *
 * Response jika user belum ada (200):
 * {
 *   "status": false,
 *   "message": "Akun belum terdaftar...",
 *   "data": null
 * }
 */
export async function POST(request: Request) {
  try {
    const data = await parseAffiliatePayload(request);
    const emailRaw =
      (data.email as string) ||
      (data.customer_email as string) ||
      (data.user_email as string) ||
      (data.buyer_email as string);

    const email = typeof emailRaw === "string" ? emailRaw.trim() : null;

    if (!email) {
      return affiliateJsonResponse(
        { status: false, message: "Field email wajib disertakan." },
        400,
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
      },
      select: { id: true, email: true },
    });

    if (user) {
      return affiliateJsonResponse({
        status: true,
        data: {
          email: user.email,
          uid: user.id,
        },
      });
    }

    // Kembalikan status: false dengan HTTP 200 agar client Axios affiliate.id tidak melempar Network Error (404/500)
    return affiliateJsonResponse({
      status: false,
      message: "Akun dengan email ini belum terdaftar di AyoTKA. Silakan daftar terlebih dahulu di ayotka.id.",
      data: null,
    });
  } catch (error) {
    console.error("[affiliate check-email error]:", error);
    return affiliateJsonResponse(
      { status: false, message: "Terjadi kesalahan internal server." },
      500,
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
