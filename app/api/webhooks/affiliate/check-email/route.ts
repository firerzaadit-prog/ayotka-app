import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Check Email Address Endpoint untuk affiliate.id (Gambar 4).
 * Request: POST { "email": "email@user.com" }
 * Response(200):
 * {
 *   "status": true,
 *   "data": {
 *     "email": "email@user.com",
 *     "uid": "user_uid"
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : null;

    if (!email) {
      return NextResponse.json(
        { status: false, message: "Field email wajib disertakan." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
      },
      select: { id: true, email: true },
    });

    if (user) {
      return NextResponse.json({
        status: true,
        data: {
          email: user.email,
          uid: user.id,
        },
      });
    }

    // Jika user belum ada di AyoTKA:
    // affiliate.id menyatakan: "Kami akan cek apakah user sudah memiliki akses atau belum."
    return NextResponse.json(
      {
        status: false,
        message: "Akun dengan email ini belum terdaftar di AyoTKA. Silakan daftar terlebih dahulu di ayotka.id.",
      },
      { status: 404 },
    );
  } catch (error) {
    console.error("[affiliate check-email error]:", error);
    return NextResponse.json(
      { status: false, message: "Terjadi kesalahan internal server." },
      { status: 500 },
    );
  }
}
