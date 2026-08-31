import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { AnalisisAiPanel } from "@/components/ai/analisis-panel";
import Link from "next/link";
import { revalidatePath } from "next/cache";

const FORMAT_TANGGAL = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function DetailSiswaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin_pusat");
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      school: true,
      attempts: {
        orderBy: { mulaiAt: "desc" },
        include: { package: true },
      },
    },
  });

  if (!student) {
    notFound();
  }

  const JALUR_LABEL: Record<string, string> = { A: "Jalur A (sekolah)", B: "Jalur B (mandiri)" };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin-pusat/siswa"
          className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Kembali ke Daftar Siswa
        </Link>
        <PageHeader
          title={`Detail Riwayat: ${student.nama}`}
          description={`NISN: ${student.nisn || "-"} • ${JALUR_LABEL[student.jalur] || student.jalur} • Sekolah: ${student.school?.nama || "Siswa Mandiri"}`}
        />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Riwayat Ujian (Attempts)</h2>
        {student.attempts.length === 0 ? (
          <p className="text-sm text-slate-500">Siswa ini belum pernah mengerjakan ujian apa pun.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {student.attempts.map((a) => (
              <Card key={a.id} className="flex flex-col gap-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">{a.package.nama}</h3>
                    <Badge
                      variant={
                        a.status === "selesai" ? "success" :
                        a.status === "berjalan" ? "warning" :
                        "neutral"
                      }
                    >
                      {a.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">Mulai: {FORMAT_TANGGAL.format(a.mulaiAt)}</p>
                  {a.selesaiAt && (
                    <p className="text-xs text-slate-500">Selesai: {FORMAT_TANGGAL.format(a.selesaiAt)}</p>
                  )}
                </div>
                
                <div className="flex justify-between items-end border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-xs text-slate-500">Skor Akhir</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {a.skorAkhir !== null ? a.skorAkhir.toFixed(1) : "-"}
                    </p>
                  </div>
                  {a.status === "selesai" && (
                    <a href={`/siswa/hasil/${a.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                      Lihat Lembar Hasil →
                    </a>
                  )}
                </div>

                {a.status === "selesai" && (
                  <div className="border-t border-slate-100 pt-4">
                    <AnalisisAiPanel attemptId={a.id} canTrigger={true} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
