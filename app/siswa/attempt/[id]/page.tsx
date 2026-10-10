"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RichText } from "@/components/soal/rich-text";
import { SoalPg } from "@/components/exam/soal-pg";
import { SoalPgKompleks } from "@/components/exam/soal-pg-kompleks";
import { SoalPgKategori } from "@/components/exam/soal-pg-kategori";
import type { ExamJawaban, ExamQuestion } from "@/components/exam/types";
import { getLocalAnswers, saveLocalAnswer } from "@/lib/exam/offline-store";
import { isJawabanKosong } from "@/lib/exam/scoring";
import { Alert } from "@/components/ui/alert";
import { WaktuTersisaCard } from "@/components/exam/waktu-tersisa-card";
import { NomorSoalCard } from "@/components/exam/nomor-soal-card";
import { formatSisaWaktuRingkas, nadaWaktu } from "@/lib/exam/format-waktu";
import { cn } from "@/lib/utils/cn";
import { FileText } from "lucide-react";

type AttemptState = {
  id: string;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  sisaDetik: number;
};

type AnswerEntry = { jawabanJson: ExamJawaban; ragu: boolean };

const RESYNC_INTERVAL_MS = 20_000;
const SAVE_DEBOUNCE_MS = 600;

export default function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [packageNama, setPackageNama] = useState("");
  const [subjectNama, setSubjectNama] = useState("");
  // Total durasi paket (detik) - dasar bar sisa waktu di kartu "Waktu Tersisa".
  const [durasiTotalDetik, setDurasiTotalDetik] = useState(0);
  // Panel "Nomor Soal" di HP (di layar lebar selalu tampil di sisi kanan).
  const [navOpen, setNavOpen] = useState(false);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionTakenOver, setSessionTakenOver] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // Ref untuk membaca jawaban terbaru di dalam async callback tanpa stale closure
  const answersRef = useRef<Record<string, AnswerEntry>>({});
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Pending saves: menyimpan payload terbaru per questionId yang belum dikirim ke server
  const pendingSaves = useRef<Map<string, { jawabanJson: ExamJawaban; ragu: boolean }>>(new Map());
  // Save yang timernya SUDAH menyala dan fetch-nya sedang berjalan (bukan lagi
  // di pendingSaves/saveTimers) - flushPendingSaves harus ikut menunggu ini,
  // bukan cuma yang masih antri, supaya submit tidak pernah mendahului jawaban
  // yang sudah "berangkat" tapi belum sempat commit ke database.
  const inFlightSaves = useRef<Set<Promise<unknown>>>(new Set());
  const hasSubmitted = useRef(false);
  const questionsRef = useRef<ExamQuestion[]>([]);

  const [tabToken] = useState(() => {
    const generate = () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    if (typeof window === "undefined") return generate();

    const storageKey = `ayotka-tab-token-${id}`;
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;

    const token = generate();
    window.sessionStorage.setItem(storageKey, token);
    return token;
  });

  // Sync refs dengan state terbaru
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

  // Terapkan jawaban dari server ke layar. Resync berkala (tiap 20 detik) bisa saja
  // menyalip debounce auto-save yang masih berjalan (600ms) - kalau data server ini
  // dipakai mentah-mentah, jawaban yang baru saja dipilih tapi belum sempat terkirim
  // bisa "hilang" sesaat dari layar. Pertahankan nilai lokal untuk soal yang masih pending.
  const terapkanJawabanServer = useCallback(
    (rows: { questionId: string; jawabanJson: ExamJawaban | null; ragu: boolean }[]) => {
      const map: Record<string, AnswerEntry> = {};
      for (const a of rows) {
        if (a.jawabanJson) map[a.questionId] = { jawabanJson: a.jawabanJson, ragu: a.ragu };
      }
      setAnswers((prev) => {
        for (const qid of pendingSaves.current.keys()) {
          if (prev[qid]) map[qid] = prev[qid];
        }
        return map;
      });
    },
    [],
  );

  const loadAttempt = useCallback(async () => {
    const res = await fetch(`/api/siswa/attempts/${id}?tabToken=${tabToken}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.error === "SESI_DIAMBIL_ALIH") {
        setSessionTakenOver(true);
        return null;
      }
      setError(data?.error ?? "Gagal memuat ujian.");
      return null;
    }
    const data = await res.json();
    setAttempt(data.attempt);
    setRemaining(data.attempt.sisaDetik);
    if (data.questions?.length > 0) {
      setPackageNama(data.package.nama);
      setSubjectNama(data.package.subjectNama ?? "");
      setDurasiTotalDetik((data.package.durasiMenit ?? 0) * 60);
      setQuestions(data.questions);
      terapkanJawabanServer(data.answers);
    }
    return data.attempt as AttemptState;
  }, [id, tabToken, terapkanJawabanServer]);

  /**
   * Penyegaran berkala yang RINGAN (tiap 20 detik): status, sisa waktu, dan jawaban
   * saja - soal tidak diunduh ulang (lihat app/api/siswa/attempts/[id]/sinkron).
   * Gangguan sesaat (jaringan putus, 429/5xx) SENGAJA diabaikan diam-diam, tidak
   * lagi memunculkan layar error yang menutup ujian: jawaban tetap aman di
   * IndexedDB & antrean simpan, dan putaran berikutnya mencoba lagi. Hanya
   * "sesi diambil alih" yang ditangani. Null = tidak ada data baru.
   */
  const syncAttempt = useCallback(async (): Promise<AttemptState | null> => {
    let res: Response;
    try {
      res = await fetch(`/api/siswa/attempts/${id}/sinkron?tabToken=${tabToken}`, { cache: "no-store" });
    } catch {
      return null;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.error === "SESI_DIAMBIL_ALIH") setSessionTakenOver(true);
      return null;
    }
    const data = await res.json().catch(() => null);
    if (!data?.attempt) return null;
    setAttempt(data.attempt);
    setRemaining(data.attempt.sisaDetik);
    if (data.attempt.status === "berjalan") terapkanJawabanServer(data.answers ?? []);
    return data.attempt as AttemptState;
  }, [id, tabToken, terapkanJawabanServer]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const a = await loadAttempt();
      setLoading(false);
      if (a?.status === "selesai" || a?.status === "kedaluwarsa") {
        router.replace(`/siswa/hasil/${id}`);
      }
    })();
  }, [id, loadAttempt, router]);

  // Pulihkan jawaban dari IndexedDB kalau ada yang belum sempat tersimpan ke server
  useEffect(() => {
    (async () => {
      const local = await getLocalAnswers(id);
      if (local.length === 0) return;
      setAnswers((prev) => {
        const next = { ...prev };
        for (const item of local) {
          if (!next[item.questionId]) {
            next[item.questionId] = {
              jawabanJson: item.jawabanJson as ExamJawaban,
              ragu: item.ragu,
            };
          }
        }
        return next;
      });
    })();
  }, [id]);

  /**
   * Flush semua pending saves ke server sebelum submit.
   * Ini memastikan jawaban terakhir yang belum sempat terkirim
   * (masih dalam debounce window, ATAU sudah mulai dikirim tapi belum
   * selesai) tetap tersimpan sebelum submit dilanjutkan.
   */
  const flushOnce = useCallback(() => {
    // Batalkan semua debounce timer yang masih antri
    for (const timer of saveTimers.current.values()) clearTimeout(timer);
    saveTimers.current.clear();

    // Kirim semua pending jawaban langsung (tanpa debounce) secara paralel,
    // DAN tunggu juga save yang timernya sudah menyala duluan (in-flight) -
    // itu sudah tidak lagi tercatat di pendingSaves/saveTimers begitu fetch-nya
    // mulai, jadi harus dilacak terpisah lewat inFlightSaves.
    const pending = Array.from(pendingSaves.current.entries());
    pendingSaves.current.clear();
    const tasks: Promise<unknown>[] = Array.from(inFlightSaves.current);
    for (const [questionId, { jawabanJson, ragu }] of pending) {
      tasks.push(
        fetch(`/api/siswa/attempts/${id}/jawaban`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, jawabanJson, ragu, tabToken }),
        }),
      );
    }
    return Promise.allSettled(tasks);
  }, [id, tabToken]);

  const flushPendingSaves = useCallback(async () => {
    // Dua putaran: putaran pertama menunggu semua yang pending/in-flight SAAT
    // flush dipanggil. Putaran kedua menjaring retry yang di-requeue ke
    // pendingSaves oleh save in-flight yang gagal PAS ditunggu di putaran
    // pertama (lihat penanganan gagal di persistAnswer) - supaya retry itu
    // tidak lolos tanpa sempat dikirim ulang sebelum submit dilanjutkan.
    await flushOnce();
    await flushOnce();
  }, [flushOnce]);

  const handleSubmit = useCallback(
    async (auto: boolean) => {
      if (hasSubmitted.current) return;
      if (!auto) {
        const terjawab = questionsRef.current.filter(
          (q) => !isJawabanKosong(answersRef.current[q.id]?.jawabanJson),
        ).length;
        const unanswered = questionsRef.current.length - terjawab;
        const msg =
          unanswered > 0
            ? `Masih ada ${unanswered} soal belum dijawab, yakin ingin submit?`
            : "Submit jawabanmu sekarang?";
        if (!window.confirm(msg)) return;
      }
      hasSubmitted.current = true;
      setSubmitting(true);

      // Pastikan semua jawaban terakhir sudah terkirim ke server sebelum submit
      await flushPendingSaves();

      const res = await fetch(`/api/siswa/attempts/${id}/submit`, { method: "POST" });
      if (res.ok) {
        router.replace(`/siswa/hasil/${id}`);
      } else {
        // Jika submit gagal (misal sudah selesai dari sisi lain), tetap redirect ke hasil
        router.replace(`/siswa/hasil/${id}`);
      }
    },
    [id, router, flushPendingSaves],
  );

  // Timer lokal (server tetap sumber kebenaran - resync berkala di bawah).
  useEffect(() => {
    if (!attempt || attempt.status !== "berjalan") return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          void handleSubmit(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [attempt, handleSubmit]);

  // Resync berkala ke server
  useEffect(() => {
    if (!attempt || attempt.status === "selesai" || attempt.status === "kedaluwarsa") return;
    const interval = setInterval(async () => {
      // Jangan resync jika sudah dalam proses submit
      if (hasSubmitted.current) return;
      // Jaring pengaman: kalau ada auto-save yang sempat gagal (jaringan/429/500)
      // dan tidak pernah dicoba lagi karena soal itu tidak disentuh lagi, coba
      // kirim ulang di sini - jangan tunggu sampai submit di ujian yang panjang.
      // Ditunggu (bukan fire-and-forget) supaya loadAttempt() di bawah membaca
      // data server yang sudah termasuk hasil flush ini, bukan data basi yang
      // bisa menimpa balik jawaban yang baru saja berhasil dikirim.
      await flushPendingSaves();
      // Soal sudah ada di layar -> penyegaran ringan. Kalau belum (halaman dibuka saat
      // sesi sedang dijeda, jadi soal belum pernah dimuat) -> muat penuh sekali.
      const a = questionsRef.current.length === 0 ? await loadAttempt() : await syncAttempt();
      if (a && (a.status === "selesai" || a.status === "kedaluwarsa")) {
        if (!hasSubmitted.current) router.replace(`/siswa/hasil/${id}`);
      }
    }, RESYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [attempt, id, loadAttempt, syncAttempt, router, flushPendingSaves]);

  // Blok copy/paste & klik kanan
  useEffect(() => {
    if (!attempt || attempt.status !== "berjalan") return;
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("paste", block);
    document.addEventListener("cut", block);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("cut", block);
    };
  }, [attempt]);

  // Deteksi pindah tab
  useEffect(() => {
    if (!attempt || attempt.status !== "berjalan") return;
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        setTabSwitchCount((c) => c + 1);
        fetch(`/api/siswa/attempts/${id}/pelanggaran`, { method: "POST" }).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [attempt, id]);

  function persistAnswer(questionId: string, jawabanJson: ExamJawaban, ragu: boolean) {
    setAnswers((prev) => ({ ...prev, [questionId]: { jawabanJson, ragu } }));
    void saveLocalAnswer(id, questionId, jawabanJson, ragu, false);

    // Catat payload terbaru untuk questionId ini (overwrite jika ada yang lama belum dikirim)
    pendingSaves.current.set(questionId, { jawabanJson, ragu });

    // Debounce: batalkan timer lama untuk questionId ini lalu buat yang baru
    const existingTimer = saveTimers.current.get(questionId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      // Ambil payload terbaru (bukan closure lama) saat timer akhirnya jalan
      const latest = pendingSaves.current.get(questionId);
      if (!latest) return; // sudah dihandle flushPendingSaves
      pendingSaves.current.delete(questionId);
      saveTimers.current.delete(questionId);

      // Dibungkus IIFE (bukan langsung di body setTimeout) supaya promise-nya
      // bisa dilacak di inFlightSaves - begitu baris di atas menghapus entry
      // dari pendingSaves/saveTimers, flushPendingSaves tidak lagi tahu save
      // ini masih berjalan kecuali lewat inFlightSaves.
      const savePromise = (async () => {
        try {
          const res = await fetch(`/api/siswa/attempts/${id}/jawaban`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId, jawabanJson: latest.jawabanJson, ragu: latest.ragu, tabToken }),
          });
          if (res.ok) {
            void saveLocalAnswer(id, questionId, latest.jawabanJson, latest.ragu, true);
          } else {
            const data = await res.json().catch(() => null);
            if (data?.error === "SESI_DIAMBIL_ALIH") {
              setSessionTakenOver(true);
            } else if (res.status !== 400 && !pendingSaves.current.has(questionId)) {
              // 400 = jawaban ditolak server (tidak cocok dengan soal) - dikirim
              // ulang pun tetap ditolak, jadi tidak diantre lagi.
              // Gagal (mis. 429/500 sesaat) & belum ada jawaban lebih baru menunggu -
              // taruh lagi ke pending supaya ikut ter-flush di resync berkala atau saat submit,
              // bukan hilang diam-diam.
              pendingSaves.current.set(questionId, latest);
            }
          }
        } catch {
          // Gagal jaringan (offline) - jawaban tetap aman di IndexedDB. Antre lagi
          // ke pending (kalau belum ada yang lebih baru) supaya ter-flush nanti.
          if (!pendingSaves.current.has(questionId)) {
            pendingSaves.current.set(questionId, latest);
          }
        }
      })();
      inFlightSaves.current.add(savePromise);
      void savePromise.finally(() => inFlightSaves.current.delete(savePromise));
    }, SAVE_DEBOUNCE_MS);
    saveTimers.current.set(questionId, timer);
  }

  if (loading) return <p className="p-6 text-sm text-slate-500">Memuat ujian...</p>;
  if (sessionTakenOver) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <Alert variant="danger">
          Ujian ini sedang dibuka di tab atau perangkat lain dengan akun yang sama. Hanya satu
          sesi yang boleh aktif — tutup halaman ini.
        </Alert>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }
  if (!attempt) return null;

  if (attempt.status === "paused") {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <Alert variant="warning">
          Sesi ujianmu sedang dijeda oleh admin sekolah. Halaman ini akan otomatis lanjut begitu
          admin membuka kembali sesimu — jangan tutup halaman ini.
        </Alert>
      </div>
    );
  }

  const question = questions[currentIndex];
  if (!question) return <p className="p-6 text-sm text-slate-500">Memuat soal...</p>;

  const answeredIds = new Set(
    Object.entries(answers)
      .filter(([, v]) => !isJawabanKosong(v.jawabanJson))
      .map(([k]) => k)
  );
  const raguIds = new Set(
    Object.entries(answers)
      .filter(([, v]) => v.ragu)
      .map(([k]) => k)
  );
  const questionIds = questions.map((q) => q.id);
  const nada = nadaWaktu(remaining);
  const isRagu = answers[question.id]?.ragu ?? false;
  const isLast = currentIndex >= questions.length - 1;

  const questionId = question.id;
  function toggleRagu(next: boolean) {
    const current = answers[questionId]?.jawabanJson;
    if (current) persistAnswer(questionId, current, next);
    else setAnswers((prev) => ({ ...prev, [questionId]: { jawabanJson: prev[questionId]?.jawabanJson ?? ({} as ExamJawaban), ragu: next } }));
  }

  function pilihNomor(index: number) {
    setCurrentIndex(index);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const tombolSelesaikan = (
    <button
      type="button"
      onClick={() => handleSubmit(false)}
      disabled={submitting}
      className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-orange-500/30 transition hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {submitting ? "Mengirim..." : "Selesaikan Ujian"}
    </button>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 pb-10">
      <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur-sm lg:static lg:mx-0 lg:rounded-2xl lg:border lg:px-5 lg:py-3 lg:shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kerjakan Try Out</p>
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{packageNama}</h1>
            </div>
          </div>
          {/* Timer ringkas di HP; di layar lebar timer ada di kartu sisi kanan. */}
          <span
            className={cn(
              "shrink-0 rounded-lg px-3 py-1 font-mono text-sm font-bold tabular-nums lg:hidden",
              nada === "kritis"
                ? "bg-rose-100 text-rose-700"
                : nada === "waspada"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-indigo-50 text-indigo-700",
            )}
            role="timer"
            aria-label="Sisa waktu"
          >
            {formatSisaWaktuRingkas(remaining)}
          </span>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-w-0 flex-col gap-4">
          {remaining <= 300 && remaining > 60 && (
            <Alert variant="warning">Sisa waktu 5 menit lagi.</Alert>
          )}
          {remaining <= 60 && remaining > 0 && (
            <Alert variant="danger">
              Sisa waktu 1 menit lagi — jawaban akan otomatis disubmit saat waktu habis.
            </Alert>
          )}
          {tabSwitchCount > 0 && (
            <Alert variant="warning">
              Terdeteksi {tabSwitchCount}x kamu meninggalkan tab ujian ini. Tetap di halaman ini
              sampai selesai.
            </Alert>
          )}

          {/* HP: Nomor Soal bisa dibuka/tutup (di layar lebar sudah tampil di sisi kanan). */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setNavOpen((o) => !o)}
              aria-expanded={navOpen}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm"
            >
              <span>
                Nomor Soal{" "}
                <span className="font-normal text-slate-500">
                  · {answeredIds.size}/{questions.length} terjawab
                </span>
              </span>
              <span aria-hidden className={cn("text-slate-400 transition-transform", navOpen && "rotate-180")}>
                ▾
              </span>
            </button>
            {navOpen && (
              <div className="mt-2">
                <NomorSoalCard
                  questionIds={questionIds}
                  currentIndex={currentIndex}
                  answeredIds={answeredIds}
                  raguIds={raguIds}
                  onSelect={pilihNomor}
                />
              </div>
            )}
          </div>

          <div className="select-none rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-slate-900">
                Soal No. {currentIndex + 1}
                <span className="ml-2 text-sm font-medium text-slate-400">dari {questions.length}</span>
              </h2>
              {subjectNama && (
                <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {subjectNama}
                </span>
              )}
            </div>

            <div className="px-5 py-5 sm:px-6">
              {question.stimulus && (
                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  {question.stimulus.judul && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <span>Stimulus: {question.stimulus.judul}</span>
                    </div>
                  )}
                  <div className="rounded-lg border border-slate-200/80 bg-white p-3.5 text-sm text-slate-800 leading-relaxed font-sans overflow-x-auto whitespace-pre-wrap">
                    <RichText text={question.stimulus.konten} />
                  </div>
                </div>
              )}

              <div className="mb-4 text-base leading-relaxed text-slate-900">
                <RichText text={question.teks} />
              </div>
              {question.media && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={question.media} alt="" className="mb-4 max-w-full rounded-lg border border-slate-200" />
              )}

              {question.format === "pg" && (
                <SoalPg
                  options={question.options}
                  value={answers[question.id]?.jawabanJson as { option_id: string } | undefined}
                  onChange={(j) => persistAnswer(question.id, j, isRagu)}
                />
              )}
              {question.format === "pg_kompleks" && (
                <SoalPgKompleks
                  options={question.options}
                  value={answers[question.id]?.jawabanJson as { option_ids: string[] } | undefined}
                  onChange={(j) => persistAnswer(question.id, j, isRagu)}
                />
              )}
              {question.format === "pg_kategori" && (
                <SoalPgKategori
                  categories={question.categories}
                  statements={question.statements}
                  value={answers[question.id]?.jawabanJson as Record<string, string> | undefined}
                  onChange={(j) => persistAnswer(question.id, j, isRagu)}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span aria-hidden>←</span> Sebelumnya
              </button>

              <button
                type="button"
                onClick={() => toggleRagu(!isRagu)}
                aria-pressed={isRagu}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  isRagu
                    ? "border-amber-300 bg-amber-100 text-amber-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <span
                  aria-hidden
                  className={cn("h-2.5 w-2.5 rounded-full border", isRagu ? "border-amber-500 bg-amber-500" : "border-slate-400")}
                />
                Tandai ragu-ragu
              </button>

              {isLast ? (
                <button
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-bold text-white shadow-sm shadow-orange-500/30 transition hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Mengirim..." : "Selesaikan Ujian"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-bold text-white shadow-sm shadow-indigo-600/30 transition hover:from-indigo-500 hover:to-violet-500"
                >
                  Selanjutnya <span aria-hidden>→</span>
                </button>
              )}
            </div>
          </div>

          {/* HP: tombol selesai di bawah kartu soal (di layar lebar ada di sisi kanan). */}
          {!isLast && <div className="lg:hidden">{tombolSelesaikan}</div>}
        </section>

        <aside className="hidden flex-col gap-4 lg:sticky lg:top-4 lg:flex">
          <WaktuTersisaCard remaining={remaining} totalDetik={durasiTotalDetik} />

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-center text-sm font-semibold text-slate-700">Sudah Selesai?</p>
            {tombolSelesaikan}
          </div>

          <NomorSoalCard
            questionIds={questionIds}
            currentIndex={currentIndex}
            answeredIds={answeredIds}
            raguIds={raguIds}
            onSelect={pilihNomor}
          />
        </aside>
      </div>
    </div>
  );
}
