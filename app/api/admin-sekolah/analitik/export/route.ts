import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";
import { resolveSchoolId } from "@/lib/schools/scope";
import { buildAnalitikSekolah } from "@/lib/analytics/sekolah";

/** Tiket 5.8: export Excel rekap kelas - sama persis datanya dengan halaman /admin-sekolah/analitik. */
export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const { ranking, kompetensi } = await buildAnalitikSekolah(schoolId, {
    classId: url.searchParams.get("classId"),
    subjectId: url.searchParams.get("subjectId"),
  });

  const workbook = new ExcelJS.Workbook();

  const rankingSheet = workbook.addWorksheet("Ranking Siswa");
  rankingSheet.columns = [
    { header: "#", key: "no", width: 6 },
    { header: "Nama", key: "nama", width: 30 },
    { header: "NISN", key: "nisn", width: 16 },
    { header: "Rata-rata Nilai", key: "rataRata", width: 16 },
    { header: "Jumlah Ujian", key: "jumlahAttempt", width: 14 },
  ];
  ranking.forEach((r, i) => {
    rankingSheet.addRow({
      no: i + 1,
      nama: r.nama,
      nisn: r.nisn ?? "-",
      rataRata: Number(r.rataRata.toFixed(1)),
      jumlahAttempt: r.jumlahAttempt,
    });
  });

  const kompetensiSheet = workbook.addWorksheet("Kompetensi");
  kompetensiSheet.columns = [
    { header: "Kode", key: "kode", width: 12 },
    { header: "Kompetensi", key: "deskripsi", width: 40 },
    { header: "Materi", key: "materi", width: 24 },
    { header: "Benar", key: "jmlBenar", width: 10 },
    { header: "Total Soal", key: "jmlSoal", width: 12 },
    { header: "Persentase", key: "persentase", width: 12 },
  ];
  kompetensi.forEach((k) => {
    kompetensiSheet.addRow({
      kode: k.kode,
      deskripsi: k.deskripsi,
      materi: k.materi,
      jmlBenar: k.jmlBenar,
      jmlSoal: k.jmlSoal,
      persentase: Number(k.persentase.toFixed(1)),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekap-analitik.xlsx"`,
    },
  });
}
