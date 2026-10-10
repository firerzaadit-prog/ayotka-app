"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, FileText } from "lucide-react";
import { RichText } from "@/components/soal/rich-text";
import { TutorAiChat, type SoalChat } from "@/components/tutor/tutor-ai-chat";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";

const FORMAT_LABEL: Record<string, string> = {
  pg: "PG",
  pg_kompleks: "PG Kompleks",
  pg_kategori: "PG Kategori",
};

export type PerSoal = {
  questionId: string;
  format: string;
  teks: string;
  media?: string | null;
  stimulus?: { id: string; tipe: string; judul: string | null; konten: string } | null;
  skor: number | null;
  skorMaks: number;
  // Bentuk aslinya beda-beda per format (lihat cast per blok di bawah) - dan
  // dipakai dari dua sumber dgn tipe beda: JSON.parse() di halaman siswa
  // (lewat fetch) vs Prisma JsonValue langsung di halaman admin (server
  // component, tanpa round-trip JSON) - unknown supaya cocok utk keduanya.
  jawabanJson?: unknown;
  pembahasan?: string | null;
  options?: { id: string; label: string; teks: string; isCorrect: boolean }[];
  statements?: { id: string; teks: string; correctLabel: string }[];
  categories?: { id: string; label: string }[];
};

/** Tanya Tutor AI di halaman pembahasan siswa. Tidak diberikan = tidak ada tombol (halaman admin, dsb). */
export type TutorProps = {
  attemptId: string;
  /** Nama paket, ditampilkan di kepala drawer. */
  judul: string;
  aktif: boolean;
  sisaHariIni: number;
  batasHarian: number;
  /** Lama percakapan disimpan (hari). */
  hariSimpan: number;
  /** Id soal yang sudah punya percakapan tersimpan (tombolnya berlabel "Lanjutkan chat Tutor AI"). */
  soalBerriwayat: string[];
  onSisaBerubah: (sisa: number) => void;
};

/** Ubah data satu soal pembahasan menjadi bahan tampilan drawer Tutor (label jawaban siswa, benar/salah, dst). */
function keSoalChat(s: PerSoal, nomor: number): SoalChat {
  const jawaban = (s.jawabanJson ?? null) as { option_id?: string; option_ids?: string[] } | Record<string, string> | null;
  let dipilihIds: string[] = [];
  let adaJawaban = false;
  if (s.format === "pg") {
    const id = (jawaban as { option_id?: string } | null)?.option_id;
    dipilihIds = id ? [id] : [];
    adaJawaban = dipilihIds.length > 0;
  } else if (s.format === "pg_kompleks") {
    dipilihIds = (jawaban as { option_ids?: string[] } | null)?.option_ids ?? [];
    adaJawaban = dipilihIds.length > 0;
  } else {
    adaJawaban = jawaban !== null && typeof jawaban === "object" && Object.keys(jawaban).length > 0;
  }
  const label = (s.options ?? []).filter((o) => dipilihIds.includes(o.id)).map((o) => o.label);
  return {
    questionId: s.questionId,
    nomor,
    format: s.format,
    adaJawaban,
    teks: s.teks,
    options: s.options?.map(({ id, label: l, teks, isCorrect }) => ({ id, label: l, teks, isCorrect })),
    jawabanLabel: s.format === "pg_kategori" || label.length === 0 ? null : label.join(", "),
    benar: (s.skor ?? 0) >= s.skorMaks,
    dipilihIds,
  };
}

/**
 * Diekstrak dari app/siswa/hasil/[id]/page.tsx (Tiket 4.10) supaya bisa
 * dipakai juga di halaman detail siswa admin pusat - satu tempat untuk
 * aturan render per format soal (pg/pg_kompleks/pg_kategori), bukan
 * disalin dua kali. Kunci jawaban dan pembahasan SELALU ditampilkan (keputusan user 25 Sep 2026, ditegaskan 8 Okt
 * 2026): tidak ada lagi gerbang "menunggu jendela ujian ditutup" - lihat lib/exam/hasil.ts.
 */
export function RincianJawaban({
  perSoal,
  tutor,
}: {
  perSoal: PerSoal[];
  tutor?: TutorProps;
}) {
  // Drawer Tutor yang pernah dibuka tetap terpasang (tidak digambar saat tertutup) supaya percakapan dan permintaan
  // yang sedang berjalan tidak hilang kalau siswa menutupnya sebentar - lihat components/tutor/tutor-ai-chat.tsx.
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [pernahDibuka, setPernahDibuka] = useState<string[]>([]);
  const terbukaRef = useRef<string | null>(null);
  // Soal yang percakapannya baru dimulai di sesi halaman ini (di luar yang sudah tersimpan dari sebelumnya).
  const [baruBerpercakapan, setBaruBerpercakapan] = useState<string[]>([]);
  // Soal yang percakapan tersimpannya sudah dihapus siswa di sesi halaman ini (daftar dari server tidak berubah sampai dimuat ulang).
  const [sudahDihapus, setSudahDihapus] = useState<string[]>([]);
  const punyaRiwayat = (id: string) =>
    (Boolean(tutor?.soalBerriwayat.includes(id)) && !sudahDihapus.includes(id)) || baruBerpercakapan.includes(id);
  useEffect(() => {
    terbukaRef.current = terbuka;
  }, [terbuka]);
  const bukaTutor = (id: string) => {
    setPernahDibuka((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setTerbuka(id);
  };
  const tutupTutor = useCallback(() => {
    const id = terbukaRef.current;
    setTerbuka(null);
    // kembalikan fokus ke tombol yang membukanya (aksesibilitas papan ketik)
    if (id) requestAnimationFrame(() => document.getElementById(`tutor-tombol-${id}`)?.focus());
  }, []);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(perSoal.length / pageSize));
  const pageSoal = perSoal.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <div className="flex flex-col gap-3">
        {pageSoal.map((s, i) => (
          <Card key={s.questionId}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Soal {(page - 1) * pageSize + i + 1} · {FORMAT_LABEL[s.format] ?? s.format}
              </span>
              <Badge variant={(s.skor ?? 0) >= s.skorMaks ? "success" : "danger"}>
                {(s.skor ?? 0) >= s.skorMaks ? "Benar" : "Salah"}
              </Badge>
            </div>
            {s.stimulus && (
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                {s.stimulus.judul && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <span>Stimulus: {s.stimulus.judul}</span>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200/80 bg-white p-3 text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap overflow-x-auto">
                  <RichText text={s.stimulus.konten} />
                </div>
              </div>
            )}
            <div className="mb-2 text-sm">
              <RichText text={s.teks} />
            </div>
            {s.options && s.options.length > 0 && (() => {
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
                          {isCorrect && isSelected && "✓ Jawaban (benar)"}
                          {isCorrect && !isSelected && "✓ Kunci"}
                          {!isCorrect && isSelected && "✗ Jawaban"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            {s.statements && s.statements.length > 0 && (() => {
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
                            Jawaban: {siswaJawab ?? "—"}{!benar && siswaJawab ? " ✗" : benar ? " ✓" : ""}
                          </span>
                          {!benar && <span className="font-medium text-emerald-700">Kunci: {st.correctLabel} ✓</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            {s.pembahasan && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium">Pembahasan: </span>
                <RichText text={s.pembahasan} />
              </div>
            )}
            {tutor?.aktif && (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  id={`tutor-tombol-${s.questionId}`}
                  onClick={() => bukaTutor(s.questionId)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700"
                >
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  {punyaRiwayat(s.questionId) ? "Lanjutkan chat Tutor AI" : "Tanya Tutor AI"}
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>
      {tutor?.aktif &&
        pernahDibuka.map((id) => {
          const indeks = perSoal.findIndex((s) => s.questionId === id);
          if (indeks < 0) return null;
          return (
            <TutorAiChat
              key={id}
              attemptId={tutor.attemptId}
              judul={tutor.judul}
              soal={keSoalChat(perSoal[indeks]!, indeks + 1)}
              buka={terbuka === id}
              sisaHariIni={tutor.sisaHariIni}
              batasHarian={tutor.batasHarian}
              hariSimpan={tutor.hariSimpan}
              adaRiwayat={tutor.soalBerriwayat.includes(id)}
              onAdaPercakapan={(qid) => setBaruBerpercakapan((prev) => (prev.includes(qid) ? prev : [...prev, qid]))}
              onRiwayatDihapus={(qid) => {
                setBaruBerpercakapan((prev) => prev.filter((x) => x !== qid));
                setSudahDihapus((prev) => (prev.includes(qid) ? prev : [...prev, qid]));
              }}
              onSisaBerubah={tutor.onSisaBerubah}
              onTutup={tutupTutor}
            />
          );
        })}
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={perSoal.length}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
