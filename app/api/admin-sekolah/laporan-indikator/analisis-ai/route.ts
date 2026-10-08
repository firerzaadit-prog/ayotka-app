import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { bacaParamLaporan } from "@/lib/indikator/laporan-param";
import { bangunLaporanIndikatorSekolah } from "@/lib/indikator/laporan-sekolah";
import { generateSekolahAnalisis } from "@/lib/ai/analyze-sekolah";

export async function GET(request: Request) {
  const param = await bacaParamLaporan(request);
  if ("galat" in param) return param.galat;
  
  const qs = new URL(request.url).searchParams;
  const kunci = qs.get("kunci");
  if (!kunci) return NextResponse.json({ error: "Parameter kunci tidak ada." }, { status: 400 });

  const aiAnalysis = await prisma.aiAnalysisSekolah.findUnique({
    where: { kunci },
  });

  if (!aiAnalysis) {
    return NextResponse.json({ status: "none" });
  }

  return NextResponse.json({
    status: "ready",
    analysis: aiAnalysis.detailJson,
    generatedAt: aiAnalysis.generatedAt.toISOString(),
    outdated: false,
  });
}

export async function POST(request: Request) {
  const param = await bacaParamLaporan(request);
  if ("galat" in param) return param.galat;
  
  const qs = new URL(request.url).searchParams;
  const kunci = qs.get("kunci");
  if (!kunci || !param.subjectId) return NextResponse.json({ error: "Parameter kunci/subjectId tidak lengkap." }, { status: 400 });

  try {
    const data = await bangunLaporanIndikatorSekolah(prisma, param.schoolId, param.subjectId, param.rentang, { pembanding: param.pembanding });
    if (!data) return NextResponse.json({ error: "Gagal menyusun laporan indikator." }, { status: 404 });

    const namaMapelResponse = await prisma.subject.findUnique({
      where: { id: param.subjectId },
      select: { nama: true }
    });
    const namaSekolahResponse = await prisma.school.findUnique({
      where: { id: param.schoolId },
      select: { nama: true }
    });

    const hasil = await generateSekolahAnalisis(kunci, param.schoolId, {
      sekolah: { nama: namaSekolahResponse?.nama ?? "Sekolah" },
      mapel: { nama: namaMapelResponse?.nama ?? "Mata Pelajaran" },
      jumlahSiswaMengerjakan: data.jumlahSiswaMengerjakan,
      jumlahPaket: data.jumlahPaket,
      laporan: data.laporan,
      wawasan: data.wawasan
    }, param.periodeLabel);
    
    return NextResponse.json({
      status: "ready",
      analysis: hasil,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gagal membuat analisis AI." }, { status: 500 });
  }
}
