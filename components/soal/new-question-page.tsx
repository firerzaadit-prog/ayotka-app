"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QuestionForm } from "@/components/soal/question-form";
import { PageHeader } from "@/components/ui/page-header";

export function NewQuestionPage({
  packageId,
  basePath,
}: {
  packageId: string;
  basePath: string;
}) {
  const [subjectId, setSubjectId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetch(`/api/packages/${packageId}`);
      const data = await res.json();
      if (!ignore) setSubjectId(data.package?.subjectId ?? null);
    })();
    return () => {
      ignore = true;
    };
  }, [packageId]);

  if (!subjectId) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`${basePath}/${packageId}`} className="text-sm text-slate-500 hover:text-slate-700">
        &larr; Kembali ke paket
      </Link>
      <PageHeader title="Tambah Soal" />
      <QuestionForm packageId={packageId} subjectId={subjectId} basePath={basePath} />
    </div>
  );
}
