"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RichText } from "@/components/soal/rich-text";
import { AnalisisAiPanel } from "@/components/ai/analisis-panel";

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
    pembahasan?: string | null;
    options?: { id: string; label: string; teks: string; isCorrect: boolean }[];
    statements?: { id: string; teks: string; correctLabel: string }[];
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
    (async () => {
      const res = await fetch(`/api/siswa/attempts/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memuat hasil.");
        return;
      }
      if (data.attempt.status === "berjalan") {
        router.replace(`/siswa/attempt/${id}`);
        return;
      }
      setHasil(data);
    })();
  }, [id, router]);

  if (error) {
    return <p className="p-6 text-sm text-red-700">{error}</p>;
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{hasil.package.nama}</h1>
          <p className="text-sm text-slate-500">
            {hasil.attempt.status === "kedaluwarsa" ? "Waktu habis — disubmit otomatis." : "Selesai."}
          </p>
        </div>
        <a
          href={`/api/siswa/attempts/${id}/rapor`}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Unduh Rapor (PDF)
        </a>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">Nilai</p>
        <p className="text-4xl font-bold text-slate-900">
          {hasil.attempt.skorAkhir?.toFixed(0) ?? "-"}
        </p>
      </div>

      {hasil.competencyScores.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Peta Kompetensi</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Kompetensi</th>
                  <th className="px-4 py-2 font-medium">Benar</th>
                  <th className="px-4 py-2 font-medium">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {hasil.competencyScores.map((c) => (
                  <tr key={c.kode} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs">{c.kode}</span> {c.deskripsi}
                    </td>
                    <td className="px-4 py-2">
                      {c.jmlBenar}/{c.jmlSoal}
                    </td>
                    <td className="px-4 py-2">{c.persentase.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Pembahasan lengkap akan tersedia setelah jendela ujian kelasmu ditutup.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {hasil.perSoal.map((s, i) => (
            <div key={s.questionId} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Soal {i + 1} · {FORMAT_LABEL[s.format] ?? s.format}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    (s.skor ?? 0) >= s.skorMaks
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {(s.skor ?? 0) >= s.skorMaks ? "Benar" : "Salah"}
                </span>
              </div>
              <p className="mb-2 text-sm">
                <RichText text={s.teks} />
              </p>
              {hasil.canShowPembahasan && s.options && (
                <ul className="mb-2 flex flex-col gap-1 text-sm">
                  {s.options.map((o) => (
                    <li
                      key={o.id}
                      className={o.isCorrect ? "font-medium text-green-700" : "text-slate-600"}
                    >
                      {o.label}. <RichText text={o.teks} />
                      {o.isCorrect && " (kunci)"}
                    </li>
                  ))}
                </ul>
              )}
              {hasil.canShowPembahasan && s.statements && (
                <ul className="mb-2 flex flex-col gap-1 text-sm">
                  {s.statements.map((st) => (
                    <li key={st.id} className="text-slate-600">
                      <RichText text={st.teks} />{" "}
                      <span className="font-medium text-green-700">— {st.correctLabel}</span>
                    </li>
                  ))}
                </ul>
              )}
              {hasil.canShowPembahasan && s.pembahasan && (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className="font-medium">Pembahasan: </span>
                  <RichText text={s.pembahasan} />
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
