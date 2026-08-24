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

type AttemptState = {
  id: string;
  status: "berjalan" | "paused" | "selesai" | "kedaluwarsa";
  sisaDetik: number;
};

type AnswerEntry = { jawabanJson: ExamJawaban; ragu: boolean };

const RESYNC_INTERVAL_MS = 20_000;
const SAVE_DEBOUNCE_MS = 800;

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

  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const hasSubmitted = useRef(false);
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
      setAnswers(map);
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
  // (mis. tab ditutup paksa saat offline lalu dibuka lagi - Tiket 4.8).
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

  const handleSubmit = useCallback(
    async (auto: boolean) => {
      if (hasSubmitted.current) return;
      if (!auto) {
        const terjawab = questions.filter(
          (q) => !isJawabanKosong(answers[q.id]?.jawabanJson),
        ).length;
        const unanswered = questions.length - terjawab;
        const msg =
          unanswered > 0
            ? `Masih ada ${unanswered} soal belum dijawab, yakin ingin submit?`
            : "Submit jawabanmu sekarang?";
        if (!window.confirm(msg)) return;
      }
      hasSubmitted.current = true;
      setSubmitting(true);
      await fetch(`/api/siswa/attempts/${id}/submit`, { method: "POST" });
      router.replace(`/siswa/hasil/${id}`);
    },
    [id, questions, answers, router],
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

  // Resync berkala ke server - meluruskan drift timer & mendeteksi pause oleh admin (Tiket 4.9).
  useEffect(() => {
    if (!attempt || attempt.status !== "berjalan") return;
    const interval = setInterval(async () => {
      const a = await loadAttempt();
      if (a && a.status !== "berjalan") {
        if (a.status === "selesai" || a.status === "kedaluwarsa") {
          router.replace(`/siswa/hasil/${id}`);
        }
      }
    }, RESYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [attempt, id, loadAttempt, router]);

  // Tiket 4.13 (dasar): blok copy/paste & klik kanan selama ujian berlangsung.
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

  // Tiket 4.13: deteksi pindah tab (basic - dicatat & ditampilkan sebagai
  // peringatan ke siswa, tidak otomatis menggagalkan ujian).
  useEffect(() => {
    if (!attempt || attempt.status !== "berjalan") return;
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        setTabSwitchCount((c) => c + 1);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [attempt]);

  function persistAnswer(questionId: string, jawabanJson: ExamJawaban, ragu: boolean) {
    setAnswers((prev) => ({ ...prev, [questionId]: { jawabanJson, ragu } }));
    void saveLocalAnswer(id, questionId, jawabanJson, ragu, false);

    const existingTimer = saveTimers.current.get(questionId);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/siswa/attempts/${id}/jawaban`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, jawabanJson, ragu, tabToken }),
        });
        if (res.ok) {
          void saveLocalAnswer(id, questionId, jawabanJson, ragu, true);
        } else {
          const data = await res.json().catch(() => null);
          if (data?.error === "SESI_DIAMBIL_ALIH") setSessionTakenOver(true);
        }
      } catch {
        // Gagal (offline) - jawaban tetap aman di IndexedDB, dicoba lagi saat soal berikutnya disimpan.
      }
    }, SAVE_DEBOUNCE_MS);
    saveTimers.current.set(questionId, timer);
  }

  if (loading) return <p className="p-6 text-sm text-slate-500">Memuat ujian...</p>;
  if (sessionTakenOver) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Ujian ini sedang dibuka di tab atau perangkat lain dengan akun yang sama. Hanya satu
          sesi yang boleh aktif — tutup halaman ini.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }
  if (!attempt) return null;

  if (attempt.status === "paused") {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Sesi ujianmu sedang dijeda oleh admin sekolah. Halaman ini akan otomatis lanjut begitu
          admin membuka kembali sesimu — jangan tutup halaman ini.
        </p>
      </div>
    );
  }

  const question = questions[currentIndex];
  if (!question) return <p className="p-6 text-sm text-slate-500">Memuat soal...</p>;

  const answeredIds = new Set(Object.keys(answers));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <span className="text-sm font-medium text-slate-900">{packageNama}</span>
        <span
          className={`rounded-md px-3 py-1 font-mono text-sm font-semibold ${
            remaining <= 60
              ? "bg-red-100 text-red-700"
              : remaining <= 300
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {formatSisaWaktu(remaining)}
        </span>
      </div>

      {remaining <= 300 && remaining > 60 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Sisa waktu 5 menit lagi.
        </p>
      )}
      {remaining <= 60 && remaining > 0 && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Sisa waktu 1 menit lagi — jawaban akan otomatis disubmit saat waktu habis.
        </p>
      )}
      {tabSwitchCount > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Terdeteksi {tabSwitchCount}x kamu meninggalkan tab ujian ini. Tetap di halaman ini
          sampai selesai.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {questions.map((q, i) => (
          <button
            key={q.id}
            onClick={() => setCurrentIndex(i)}
            className={`h-8 w-8 rounded-md text-xs font-medium ${
              i === currentIndex
                ? "bg-slate-900 text-white"
                : answers[q.id]?.ragu
                  ? "bg-amber-100 text-amber-800"
                  : answeredIds.has(q.id)
                    ? "bg-green-100 text-green-800"
                    : "bg-slate-100 text-slate-500"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 select-none">
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
            />
            Tandai ragu-ragu
          </label>
        </div>

        <p className="mb-4 text-base">
          <RichText text={question.teks} />
        </p>
        {question.media && (
          <img src={question.media} alt="" className="mb-4 max-w-full rounded-md border" />
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

      <div className="fixed inset-x-0 bottom-0 flex justify-between border-t border-slate-200 bg-white px-4 py-3">
        <button
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Sebelumnya
        </button>
        {currentIndex < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Selanjutnya
          </button>
        ) : (
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Mengirim..." : "Submit"}
          </button>
        )}
      </div>
    </div>
  );
}
