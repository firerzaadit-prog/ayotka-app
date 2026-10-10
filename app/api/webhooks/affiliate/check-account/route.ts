import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

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
    const body = await request.json().catch(() => ({}));
    const uid = typeof body.uid === "string" ? body.uid.trim() : null;

    if (!uid) {
      return NextResponse.json(
        { status: false, message: "Field uid wajib disertakan." },
        { status: 400 },
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
      return NextResponse.json(
        { status: false, message: "Profil siswa tidak ditemukan untuk uid tersebut." },
        { status: 404 },
      );
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { status: false, message: "Terjadi kesalahan internal server." },
      { status: 500 },
    );
  }
}
