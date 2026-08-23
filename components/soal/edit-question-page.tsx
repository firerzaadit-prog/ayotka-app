"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QuestionForm, type QuestionFormInitial } from "@/components/soal/question-form";

export function EditQuestionPage({
  packageId,
  questionId,
  basePath,
}: {
  packageId: string;
  questionId: string;
  basePath: string;
}) {
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [initial, setInitial] = useState<QuestionFormInitial | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [pkgRes, qRes] = await Promise.all([
        fetch(`/api/packages/${packageId}`),
        fetch(`/api/questions/${questionId}`),
      ]);
      const pkgData = await pkgRes.json();
      const qData = await qRes.json();
      if (ignore) return;

      setSubjectId(pkgData.package?.subjectId ?? null);
      setLocked(Boolean(qData.locked));

      const q = qData.question;
      if (q) {
        setInitial({
          id: q.id,
          format: q.format,
          teks: q.teks,
          media: q.media,
          bobot: q.bobot,
          tingkatKesulitan: q.tingkatKesulitan,
          materiId: q.materiId,
          subMateriId: q.subMateriId,
          kompetensiId: q.kompetensiId,
          levelBloom: q.levelBloom,
          pembahasan: q.pembahasan,
          options: q.options ?? [],
          statements: (q.statements ?? []).map((s: { teks: string; media: string | null; urutan: number; correctCategoryId: string }) => ({
            teks: s.teks,
            media: s.media,
            urutan: s.urutan,
            correctCategory:
              q.categories?.find((c: { id: string; label: string }) => c.id === s.correctCategoryId)
                ?.label === "Benar"
                ? "Benar"
                : "Salah",
          })),
        });
      }
    })();
    return () => {
      ignore = true;
    };
  }, [packageId, questionId]);

  if (!subjectId || !initial) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`${basePath}/${packageId}`} className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Kembali ke paket
      </Link>
      <h1 className="text-xl font-semibold text-slate-900">
        {locked ? "Lihat Soal" : "Edit Soal"}
      </h1>
      <QuestionForm
        packageId={packageId}
        subjectId={subjectId}
        basePath={basePath}
        initial={initial}
        locked={locked}
      />
    </div>
  );
}
