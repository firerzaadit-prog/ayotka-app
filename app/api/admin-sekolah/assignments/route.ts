import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit/log";
import { resolveSchoolId } from "@/lib/schools/scope";
import { assignmentCreateSchema } from "@/lib/validations/assignment";
import { wherePaketTersedia } from "@/lib/exam/paket-tersedia";
import { periksaJadwalPenugasan } from "@/lib/exam/jadwal-penugasan";
import { ambilPeriodeSekolah } from "@/lib/billing/periode-sekolah";
import { hitungKursiTerpakai } from "@/lib/students/create";

/** Tiket 4.2: Try Out Bersama (penugasan ujian) oleh admin sekolah - pilih paket, jendela waktu, target seluruh sekolah. */
export async function GET() {
    let user;
    try {
        user = await requireRole("admin_sekolah", "admin_pusat");
    } catch {
        return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
    }

    const schoolId = await resolveSchoolId(user, null);
    if (!schoolId) {
        return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
    }

    const assignments = await prisma.assignment.findMany({
        where: { schoolId },
        orderBy: { mulai: "desc" },
        include: {
            package: {
                select: { nama: true, jumlahSoal: true, durasiMenit: true, kategori: true, ownerType: true, subject: { select: { nama: true } } },
            },
            _count: { select: { attempts: true } },
        },
    });

    // Berapa siswa yang sudah selesai per penugasan: dihitung per SISWA (bukan per percobaan) supaya pengulangan
    // tidak menggandakan hitungan.
    const selesai = assignments.length
        ? await prisma.attempt.findMany({
              where: { assignmentId: { in: assignments.map((a) => a.id) }, status: { in: ["selesai", "kedaluwarsa"] } },
              select: { assignmentId: true, studentId: true },
              distinct: ["assignmentId", "studentId"],
          })
        : [];
    const selesaiPerPenugasan = new Map<string, number>();
    for (const s of selesai) {
        if (s.assignmentId) selesaiPerPenugasan.set(s.assignmentId, (selesaiPerPenugasan.get(s.assignmentId) ?? 0) + 1);
    }

    return NextResponse.json({
        // Jam server dipakai klien untuk menentukan status (akan datang/berlangsung/selesai) tanpa terpengaruh jam komputer admin.
        sekarang: new Date().toISOString(),
        jumlahSiswa: await hitungKursiTerpakai(schoolId),
        assignments: assignments.map(({ package: paket, ...a }) => ({
            ...a,
            package: { nama: paket.nama, jumlahSoal: paket.jumlahSoal, durasiMenit: paket.durasiMenit, kategori: paket.kategori, mapel: paket.subject.nama, dirilisPusat: paket.ownerType === "pusat" },
            siswaSelesai: selesaiPerPenugasan.get(a.id) ?? 0,
        })),
    });
}

export async function POST(request: Request) {
    let user;
    try {
        user = await requireRole("admin_sekolah", "admin_pusat");
    } catch {
        return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
    }

    const schoolId = await resolveSchoolId(user, null);
    if (!schoolId) {
        return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = assignmentCreateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? "Data tidak valid." },
            { status: 400 },
        );
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { jenjang: true } });
    if (!school) {
        return NextResponse.json({ error: "Sekolah tidak ditemukan." }, { status: 404 });
    }

    // Aturan "paket mana yang boleh" sama persis dengan daftar pilihan (lib/exam/paket-tersedia.ts); jenjang
    // diperiksa terpisah supaya paket jenjang lain mendapat pesan yang jelas, bukan "tidak ditemukan".
    const pkg = await prisma.package.findFirst({ where: { id: parsed.data.packageId, ...wherePaketTersedia(schoolId) } });
    if (!pkg) {
        return NextResponse.json({ error: "Paket soal tidak ditemukan atau tidak tersedia." }, { status: 404 });
    }
    if (pkg.jenjang !== school.jenjang) {
        return NextResponse.json(
            { error: `Paket ini untuk jenjang ${pkg.jenjang}, sedangkan sekolahmu jenjang ${school.jenjang}. Pilih paket jenjang ${school.jenjang}.`, code: "JENJANG_BEDA" },
            { status: 400 },
        );
    }

    const jadwal = periksaJadwalPenugasan({
        mulai: parsed.data.mulai,
        selesai: parsed.data.selesai,
        sekarang: new Date(),
        periode: await ambilPeriodeSekolah(prisma, schoolId),
    });
    if (!jadwal.ok) {
        return NextResponse.json({ error: jadwal.error, code: jadwal.code }, { status: jadwal.status });
    }

    const assignment = await prisma.assignment.create({
        data: {
            packageId: pkg.id,
            schoolId,
            mulai: parsed.data.mulai,
            selesai: parsed.data.selesai,
        },
    });

    await logAudit({
        userId: user.id,
        aksi: "create",
        entitas: "assignments",
        entitasId: assignment.id,
        after: assignment,
        ip: getClientIp(request),
    });

    return NextResponse.json({ assignment }, { status: 201 });
}
