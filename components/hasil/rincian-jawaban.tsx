"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, FileText } from "lucide-react";
import { RichText } from "@/components/soal/rich-text";
import { MediaIlustrasi } from "@/components/soal/media-ilustrasi";
import { TutorAiChat, type SoalChat } from "@/components/tutor/tutor-ai-chat";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pagination, DEFAULT_PAGE_SIZE } from "@/components/ui/pagination";

const KESULITAN_LABEL: Record<string, string> = {
  mudah: "Rendah",
  rendah: "Rendah",
  sedang: "Sedang",
  sulit: "Tinggi",
  tinggi: "Tinggi",
};

const FORMAT_KETERANGAN: Record<string, string> = {
  pg: "Pilihan Ganda (Pilih 1 kunci jawaban benar)",
  pg_kompleks: "Pilihan Ganda Kompleks (Bisa lebih dari 1 kunci jawaban benar)",
  pg_kategori: "Pilihan Ganda Kategori (Tentukan kategori tiap pernyataan)",
};

export type HierarkiIndikatorSoal = {
  namaMapel: string;
  jumlahTingkat: 3 | 4;
  items: { label: string; nilai: string }[];
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
  tingkatKesulitan?: string | null;
  kompetensiNama?: string | null;
  paketNama?: string | null;
  hierarki?: HierarkiIndikatorSoal | null;
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
      <div className="flex flex-col gap-6">
        {pageSoal.map((s, i) => {
          const nomorSoal = (page - 1) * pageSize + i + 1;
          const benar = (s.skor ?? 0) >= s.skorMaks;
          return (
            <div
              key={s.questionId}
              className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-shadow hover:shadow-md"
            >
              {/* Header Banner ala soal.ayotka.id */}
              <div className="flex flex-col gap-2.5 border-b border-slate-800 bg-slate-900 p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-indigo-600 px-2 font-mono text-xs font-bold text-white shadow-xs">
                      #{nomorSoal}
                    </span>
                    <span className="text-sm font-bold tracking-wide text-white">
                      Soal #{nomorSoal}
                    </span>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-300 ring-1 ring-white/15">
                      {s.format === "pg" ? "PG" : s.format === "pg_kompleks" ? "PG Kompleks" : "PG Kategori"}
                    </span>
                    {s.tingkatKesulitan && (
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ${
                          s.tingkatKesulitan === "mudah" || s.tingkatKesulitan === "rendah"
                            ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                            : s.tingkatKesulitan === "sedang"
                            ? "bg-amber-500/20 text-amber-300 ring-amber-500/30"
                            : "bg-rose-500/20 text-rose-300 ring-rose-500/30"
                        }`}
                      >
                        {KESULITAN_LABEL[s.tingkatKesulitan] ?? s.tingkatKesulitan}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {s.paketNama ? `${s.paketNama} · ` : ""}{s.kompetensiNama ?? s.hierarki?.items?.[0]?.nilai ?? "Kompetensi"}
                  </p>
                </div>
                <div className="shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                      benar
                        ? "border border-emerald-400/20 bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                        : "border border-rose-400/20 bg-rose-500/20 text-rose-300 ring-rose-500/30"
                    }`}
                  >
                    {benar ? "✓ Benar" : "✗ Salah"}
                  </span>
                </div>
              </div>

              {/* Body Konten Soal */}
              <div className="flex flex-col gap-5 p-5 sm:p-6">
                {/* 1. Hierarki Indikator Box */}
                {s.hierarki && Array.isArray(s.hierarki.items) && s.hierarki.items.length > 0 && (
                  <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50/60 via-white to-indigo-50/30 p-4 sm:p-5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 border-b border-sky-100 pb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-sky-950">
                        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-sky-600" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                        </svg>
                        <span>Hierarki Indikator</span>
                      </div>
                      <span className="rounded-full border border-sky-200 bg-sky-100/70 px-3 py-0.5 font-mono text-[11px] font-bold text-sky-800">
                        {s.hierarki.namaMapel} ({s.hierarki.jumlahTingkat} Tingkat)
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      {s.hierarki.items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-[110px_1fr] sm:grid-cols-[140px_1fr] gap-2 text-xs">
                          <span className="font-medium text-slate-500">{item.label}:</span>
                          <span className="font-bold text-slate-900 leading-relaxed">{item.nilai}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. TEKS SOAL */}
                <div>
                  <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-400">TEKS SOAL</p>
                  <div className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4 sm:p-5 text-sm leading-relaxed text-slate-800">
                    {s.stimulus && (
                      <div className="mb-4 space-y-2 rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5">
                        {s.stimulus.judul && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                            <FileText className="h-4 w-4 text-indigo-600" />
                            <span>Stimulus: {s.stimulus.judul}</span>
                          </div>
                        )}
                        <div className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-indigo-100/70 bg-white p-3 font-sans text-xs leading-relaxed text-slate-700 shadow-2xs">
                          <RichText text={s.stimulus.konten} />
                        </div>
                      </div>
                    )}
                    <div>
                      <RichText text={s.teks} />
                    </div>
                    {s.media && (
                      <MediaIlustrasi media={s.media} className="mt-3" />
                    )}
                  </div>
                </div>

                {/* 3. PILIHAN JAWABAN */}
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">PILIHAN JAWABAN</p>
                    <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-800">
                      {FORMAT_KETERANGAN[s.format] ?? "Pilihan Ganda"}
                    </span>
                  </div>

                  {s.options && s.options.length > 0 && (() => {
                    const jawaban = s.jawabanJson as { option_id?: string; option_ids?: string[] } | null;
                    const selectedId = jawaban?.option_id;
                    const selectedIds = new Set(jawaban?.option_ids ?? []);
                    return (
                      <ul className="flex flex-col gap-2.5 text-sm">
                        {s.options.map((o) => {
                          const isSelected = s.format === "pg" ? o.id === selectedId : selectedIds.has(o.id);
                          const isCorrect = o.isCorrect;
                          return (
                            <li
                              key={o.id}
                              className={[
                                "flex items-start gap-3 rounded-xl border p-3.5 transition-all",
                                isCorrect
                                  ? "border-emerald-400 bg-emerald-50/40 text-emerald-950 ring-1 ring-emerald-500/20"
                                  : isSelected
                                  ? "border-rose-300 bg-rose-50/40 text-rose-950 ring-1 ring-rose-500/20"
                                  : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300"
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-bold text-xs shadow-xs",
                                  isCorrect
                                    ? "bg-emerald-600 text-white"
                                    : isSelected
                                    ? "bg-rose-600 text-white"
                                    : "bg-slate-100 text-slate-600"
                                ].join(" ")}
                              >
                                {o.label}
                              </span>
                              <span className="flex-1 pt-0.5 leading-relaxed font-medium">
                                <RichText text={o.teks} />
                              </span>
                              <span className="shrink-0 text-xs">
                                {isCorrect && isSelected && (
                                  <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 shadow-2xs">
                                    ✓ Kunci · Jawabanmu (Benar)
                                  </span>
                                )}
                                {isCorrect && !isSelected && (
                                  <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800 shadow-2xs">
                                    ✓ Kunci
                                  </span>
                                )}
                                {!isCorrect && isSelected && (
                                  <span className="inline-flex items-center rounded-md border border-rose-300 bg-rose-100 px-2 py-0.5 font-bold text-rose-800 shadow-2xs">
                                    ✗ Jawabanmu (Salah)
                                  </span>
                                )}
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
                      <ul className="flex flex-col gap-2.5 text-sm">
                        {s.statements.map((st) => {
                          const siswaJawab = s.categories?.find((c) => c.id === (jawaban?.[st.id]))?.label ?? null;
                          const benarBaris = siswaJawab === st.correctLabel;
                          return (
                            <li
                              key={st.id}
                              className={`flex flex-col gap-2 rounded-xl border p-3.5 ${
                                benarBaris
                                  ? "border-emerald-300 bg-emerald-50/30"
                                  : "border-rose-300 bg-rose-50/30"
                              }`}
                            >
                              <span className="font-medium text-slate-800 leading-relaxed">
                                <RichText text={st.teks} />
                              </span>
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <span className={siswaJawab ? (benarBaris ? "font-bold text-emerald-700" : "font-bold text-rose-600") : "text-slate-400"}>
                                  Jawabanmu: {siswaJawab ?? "—"}{!benarBaris && siswaJawab ? " ✗" : benarBaris ? " ✓" : ""}
                                </span>
                                {!benarBaris && (
                                  <span className="font-bold text-emerald-700">Kunci: {st.correctLabel} ✓</span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  })()}
                </div>

                {/* 4. PEMBAHASAN */}
                {s.pembahasan && (
                  <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/40 p-4 sm:p-5 shadow-2xs">
                    <div className="mb-2 flex items-center gap-2 text-indigo-950">
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-indigo-600" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                      </svg>
                      <span className="font-bold text-xs uppercase tracking-wider text-indigo-900">Pembahasan</span>
                    </div>
                    <div className="text-xs sm:text-sm font-normal leading-relaxed text-slate-700">
                      <RichText text={s.pembahasan} />
                    </div>
                  </div>
                )}

                {/* 5. Tutor AI Button */}
                {tutor?.aktif && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      id={`tutor-tombol-${s.questionId}`}
                      onClick={() => bukaTutor(s.questionId)}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:from-blue-700 hover:to-indigo-700"
                    >
                      <Bot className="h-4 w-4" aria-hidden="true" />
                      {punyaRiwayat(s.questionId) ? "Lanjutkan chat Tutor AI" : "Tanya Tutor AI"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
