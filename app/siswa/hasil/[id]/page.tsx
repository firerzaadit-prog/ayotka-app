"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RichText } from "@/components/soal/rich-text";
import { AnalisisAiPanel } from "@/components/ai/analisis-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";

const FORMAT_LABEL: Record<string, string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

type Hasil = {
  attempt: {
    id: string;
    status: string;
    skorMentah: number | null;
    skorAkhir: number | null;
    mulaiAt: string;
    selesaiAt: string | null;
  };
  package: { nama: string };
  siswa: { nama: string; idSamar: string };
  canShowPembahasan: boolean;
  perSoal: {
    questionId: string;
    format: string;
    teks: string;
    skor: number | null;
    skorMaks: number;
    jawabanJson?: Record<string, unknown> | null;
    pembahasan?: string | null;
    options?: { id: string; label: string; teks: string; isCorrect: boolean }[];
    statements?: { id: string; teks: string; correctLabel: string }[];
    categories?: { id: string; label: string }[];
  }[];
  competencyScores: { kode: string; deskripsi: string; jmlBenar: number; jmlSoal: number; persentase: number }[];
};

/**
 * Tiket 5.9: watermark identitas siswa di halaman pembahasan (bank soal
 * gampang bocor lewat screenshot kalau tidak ada jejak siapa yang
 * mengambilnya) - dirender sebagai background berulang, jadi ikut
 * terbawa di screenshot, bukan overlay terpisah yang gampang dihapus.
 */
function watermarkBackground(nama: string, idSamar: string): string {
  const escaped = `${nama} · ${idSamar}`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><text x="0" y="90" transform="rotate(-28 160 80)" font-family="sans-serif" font-size="13" fill="rgba(15,23,42,0.14)">${escaped}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Tiket 4.10: halaman hasil - nilai, rincian benar/salah, pembahasan (kalau sudah boleh tampil). */
export default function HasilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let retryCount = 0;
    const MAX_RETRIES = 10; // tunggu hingga 10 × 800ms = ~8 detik
    const RETRY_DELAY_MS = 800;

    async function tryLoad() {
      const res = await fetch(`/api/siswa/attempts/${id}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memuat hasil.");
        return;
      }
      // Jika ujian masih berjalan, kemungkinan finalize belum selesai di server.
      // Coba beberapa kali sebelum menyerah dan redirect.
      if (data.attempt.status === "berjalan" || data.attempt.status === "paused") {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          setTimeout(tryLoad, RETRY_DELAY_MS);
        } else {
          // Setelah MAX_RETRIES tetap belum selesai, kembalikan ke halaman ujian
          router.replace(`/siswa/attempt/${id}`);
        }
        return;
      }
      setHasil(data);
    }

    void tryLoad();
  }, [id, router]);

  if (error) {
    return <p className="p-6 text-sm text-rose-700">{error}</p>;
  }
  if (!hasil) {
    return <p className="p-6 text-sm text-slate-500">Memuat hasil...</p>;
  }

  return (
    <div className="relative mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundImage: watermarkBackground(hasil.siswa.nama, hasil.siswa.idSamar) }}
      />
      <PageHeader
        title={hasil.package.nama}
        description={hasil.attempt.status === "kedaluwarsa" ? "Waktu habis — disubmit otomatis." : "Selesai."}
        action={
          <a href={`/api/siswa/attempts/${id}/rapor`} className={buttonClassName("secondary")}>
            Unduh Rapor (PDF)
          </a>
        }
      />

      <Card className="text-center">
        <p className="text-sm text-slate-500">Nilai</p>
        <p className="text-4xl font-bold text-slate-900">
          {hasil.attempt.skorAkhir?.toFixed(0) ?? "-"}
        </p>
      </Card>

      {hasil.competencyScores.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Peta Kompetensi</h2>
          <TableContainer>
            <Table>
              <Thead>
                <Tr>
                  <Th>Kompetensi</Th>
                  <Th>Benar</Th>
                  <Th>Persentase</Th>
                </Tr>
              </Thead>
              <tbody>
                {hasil.competencyScores.map((c) => (
                  <Tr key={c.kode}>
                    <Td>
                      <span className="font-mono text-xs">{c.kode}</span> {c.deskripsi}
                    </Td>
                    <Td>
                      {c.jmlBenar}/{c.jmlSoal}
                    </Td>
                    <Td>{c.persentase.toFixed(0)}%</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        </div>
      )}

      <AnalisisAiPanel attemptId={id} canTrigger={false} />

      <div
        className="select-none"
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
      >
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Rincian Jawaban</h2>
        {!hasil.canShowPembahasan && (
          <Alert variant="warning" className="mb-3">
            Pembahasan lengkap akan tersedia setelah jendela ujian kelasmu ditutup.
          </Alert>
        )}
        <div className="flex flex-col gap-3">
          {hasil.perSoal.map((s, i) => (
            <Card key={s.questionId}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Soal {i + 1} · {FORMAT_LABEL[s.format] ?? s.format}
                </span>
                <Badge variant={(s.skor ?? 0) >= s.skorMaks ? "success" : "danger"}>
                  {(s.skor ?? 0) >= s.skorMaks ? "Benar" : "Salah"}
                </Badge>
              </div>
              <p className="mb-2 text-sm">
                <RichText text={s.teks} />
              </p>
              {hasil.canShowPembahasan && s.options && (() => {
                const jawaban = s.jawabanJson as { option_id?: string; option_ids?: string[] } | null;
                const selectedId = jawaban?.option_id;
                const selectedIds = new Set(jawaban?.option_ids ?? []);
                return (
                  <ul className="mb-2 flex flex-col gap-1 text-sm">
                    {s.options.map((o) => {
                      const isSelected = s.format === "pg" ? o.id === selectedId : selectedIds.has(o.id);
                      const isCorrect = o.isCorrect;
                      return (
                        <li
                          key={o.id}
                          className={[
                            "flex items-start gap-2 rounded-lg px-2 py-1",
                            isCorrect && isSelected ? "bg-emerald-50 font-medium text-emerald-700" :
                            isCorrect ? "bg-emerald-50 font-medium text-emerald-700" :
                            isSelected ? "bg-rose-50 font-medium text-rose-600" :
                            "text-slate-500"
                          ].filter(Boolean).join(" ")}
                        >
                          <span className="shrink-0">{o.label}.</span>
                          <span className="flex-1"><RichText text={o.teks} /></span>
                          <span className="shrink-0 text-xs">
                            {isCorrect && isSelected && "✓ Jawaban kamu (benar)"}
                            {isCorrect && !isSelected && "✓ Kunci"}
                            {!isCorrect && isSelected && "✗ Jawaban kamu"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
              {hasil.canShowPembahasan && s.statements && (() => {
                const jawaban = s.jawabanJson as Record<string, string> | null;
                return (
                  <ul className="mb-2 flex flex-col gap-1 text-sm">
                    {s.statements.map((st) => {
                      const siswaJawab = s.categories?.find((c) => c.id === (jawaban?.[st.id]))?.label ?? null;
                      const benar = siswaJawab === st.correctLabel;
                      return (
                        <li key={st.id} className="rounded-lg px-2 py-1">
                          <span className="text-slate-600"><RichText text={st.teks} /></span>
                          <div className="mt-1 flex gap-4 text-xs">
                            <span className={siswaJawab ? (benar ? "font-medium text-emerald-700" : "font-medium text-rose-600") : "text-slate-400"}>
                              Jawaban kamu: {siswaJawab ?? "—"}{!benar && siswaJawab ? " ✗" : benar ? " ✓" : ""}
                            </span>
                            {!benar && <span className="font-medium text-emerald-700">Kunci: {st.correctLabel} ✓</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                );
              })()}
              {hasil.canShowPembahasan && s.pembahasan && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="font-medium">Pembahasan: </span>
                  <RichText text={s.pembahasan} />
                </p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
