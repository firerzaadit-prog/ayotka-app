import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { getActiveAssignmentsFor, getSelfSelectPackagesFor } from "@/lib/exam/visibility";
import { statusSeriMandiri } from "@/lib/exam/seri-mandiri";
import { getRingkasanAksesUjian } from "@/lib/billing/akses-ujian";

/**
 * Semua yang dibutuhkan halaman instruksi (app/siswa/(shell)/ujian/mulai) untuk SATU
 * ujian dalam satu permintaan: data ujian (nama, jumlah soal, durasi, jadwal, status
 * buka seri) + ringkasan akses siswa (gratis/langganan/sekolah, jatah ujian gratis,
 * saldo/harga/jatah Learning Analytics). Dulu halaman itu memanggil GET /api/siswa/ujian
 * (daftar lengkap semua ujian, riwayat, entitlement) hanya untuk mencari satu paket,
 * ditambah satu permintaan akses terpisah - sekarang cukup satu yang jauh lebih ringan.
 *
 * Ujian harus termasuk yang MEMANG tersedia untuk siswa ini (daftar self-select yang sama
 * dengan GET /api/siswa/ujian & gerbang POST /api/siswa/attempts, atau penugasan aktif
 * sekolahnya) - kalau tidak, 404. Cuma baca; keputusan sesungguhnya tetap gerbang server
 * di POST /api/siswa/attempts.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole("siswa");
  } catch {
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 403 });
  }

  const student = await prisma.student.findFirst({ where: { userId: user.id } });
  if (!student) {
    return NextResponse.json({ error: "Profil siswa tidak ditemukan." }, { status: 404 });
  }

  const url = new URL(request.url);
  const packageId = url.searchParams.get("packageId");
  const assignmentId = url.searchParams.get("assignmentId");
  if (!packageId === !assignmentId) {
    return NextResponse.json({ error: "Isi salah satu: packageId atau assignmentId." }, { status: 400 });
  }

  let info: Record<string, unknown> | null = null;
  let subject: { id: string; nama: string } | null = null;

  if (packageId) {
    const options = await getSelfSelectPackagesFor(student, { includeUpcoming: true });
    const paket = options.find((p) => p.id === packageId);
    if (paket) {
      // Sama persis dengan gerbang mulai ujian: prasyarat dicari dari paket seri yang TERLIHAT siswa.
      const statusSeri = await statusSeriMandiri(
        student.id,
        { id: paket.id, subjectId: paket.subjectId, urutanSeri: paket.urutanSeri },
        options.filter((p) => p.subjectId === paket.subjectId && p.kategori === "mandiri"),
      );
      subject = { id: paket.subject.id, nama: paket.subject.nama };
      info = {
        nama: paket.nama,
        jumlahSoal: paket.jumlahSoal,
        durasiMenit: paket.durasiMenit,
        kategori: paket.kategori,
        bukaMulai: paket.bukaMulai,
        subject,
        statusSeri,
      };
    }
  } else if (assignmentId) {
    const aktif = await getActiveAssignmentsFor(student);
    const penugasan = aktif.find((a) => a.id === assignmentId);
    if (penugasan) {
      subject = { id: penugasan.package.subject.id, nama: penugasan.package.subject.nama };
      info = {
        nama: penugasan.package.nama,
        jumlahSoal: penugasan.package.jumlahSoal,
        durasiMenit: penugasan.package.durasiMenit,
        // Sama seperti sebelumnya: ujian terjadwal diperlakukan sebagai try out mandiri di halaman instruksi.
        kategori: "mandiri",
        selesai: penugasan.selesai,
        subject,
        statusSeri: { terkunci: false },
      };
    }
  }

  if (!info || !subject) {
    return NextResponse.json({ error: "Ujian tidak ditemukan." }, { status: 404 });
  }

  const ringkasan = await getRingkasanAksesUjian(student, subject);
  return NextResponse.json({ ...ringkasan, info }, { headers: { "Cache-Control": "no-store" } });
}
