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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type AttemptState = {
  id: string;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  sisaDetik: number;
};

type AnswerEntry = { jawabanJson: ExamJawaban; ragu: boolean };

const RESYNC_INTERVAL_MS = 20_000;
const SAVE_DEBOUNCE_MS = 600;

function formatSisaWaktu(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [packageNama, setPackageNama] = useState("");
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
      setQuestions(data.questions);
      const map: Record<string, AnswerEntry> = {};
      for (const a of data.answers) {
        if (a.jawabanJson) map[a.questionId] = { jawabanJson: a.jawabanJson, ragu: a.ragu };
      }
      // Resync berkala (tiap 20 detik) bisa saja menyalip debounce auto-save yang
      // masih berjalan (600ms) - kalau data server ini dipakai mentah-mentah,
      // jawaban yang baru saja dipilih tapi belum sempat terkirim bisa "hilang"
      // sesaat dari layar. Pertahankan nilai lokal untuk soal yang masih pending.
      setAnswers((prev) => {
        for (const qid of pendingSaves.current.keys()) {
          if (prev[qid]) map[qid] = prev[qid];
        }
        return map;
      });
    }
    return data.attempt as AttemptState;
  }, [id, tabToken]);

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
      const a = await loadAttempt();
      if (a && (a.status === "selesai" || a.status === "kedaluwarsa")) {
        if (!hasSubmitted.current) router.replace(`/siswa/hasil/${id}`);
      }
    }, RESYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [attempt, id, loadAttempt, router, flushPendingSaves]);

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
            } else if (!pendingSaves.current.has(questionId)) {
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

  const answeredIds = new Set(Object.keys(answers));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg border border-slate-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur-sm">
        <span className="text-sm font-medium text-slate-900">{packageNama}</span>
        <span
          className={cn(
            "rounded-lg px-3 py-1 font-mono text-sm font-semibold",
            remaining <= 60
              ? "bg-rose-100 text-rose-700"
              : remaining <= 300
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-700",
          )}
        >
          {formatSisaWaktu(remaining)}
        </span>
      </div>

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

      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              "h-8 w-8 rounded-lg text-xs font-medium transition-colors",
              i === currentIndex
                ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                : answers[q.id]?.ragu
                  ? "bg-amber-100 text-amber-800"
                  : answeredIds.has(q.id)
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-500",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 select-none">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">Soal {currentIndex + 1}</p>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={answers[question.id]?.ragu ?? false}
              onChange={(e) => {
                const current = answers[question.id]?.jawabanJson;
                if (current) persistAnswer(question.id, current, e.target.checked);
                else setAnswers((prev) => ({ ...prev, [question.id]: { jawabanJson: prev[question.id]?.jawabanJson ?? ({} as ExamJawaban), ragu: e.target.checked } }));
              }}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
            />
            Tandai ragu-ragu
          </label>
        </div>

        <p className="mb-4 text-base">
          <RichText text={question.teks} />
        </p>
        {question.media && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={question.media} alt="" className="mb-4 max-w-full rounded-lg border border-slate-200" />
        )}

        {question.format === "pg" && (
          <SoalPg
            options={question.options}
            value={answers[question.id]?.jawabanJson as { option_id: string } | undefined}
            onChange={(j) => persistAnswer(question.id, j, answers[question.id]?.ragu ?? false)}
          />
        )}
        {question.format === "pg_kompleks" && (
          <SoalPgKompleks
            options={question.options}
            value={answers[question.id]?.jawabanJson as { option_ids: string[] } | undefined}
            onChange={(j) => persistAnswer(question.id, j, answers[question.id]?.ragu ?? false)}
          />
        )}
        {question.format === "pg_kategori" && (
          <SoalPgKategori
            categories={question.categories}
            statements={question.statements}
            value={answers[question.id]?.jawabanJson as Record<string, string> | undefined}
            onChange={(j) => persistAnswer(question.id, j, answers[question.id]?.ragu ?? false)}
          />
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 flex justify-between border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <Button
          variant="secondary"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          Sebelumnya
        </Button>
        {currentIndex < questions.length - 1 ? (
          <Button onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}>
            Selanjutnya
          </Button>
        ) : (
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Mengirim..." : "Submit"}
          </button>
        )}
      </div>
    </div>
  );
}
