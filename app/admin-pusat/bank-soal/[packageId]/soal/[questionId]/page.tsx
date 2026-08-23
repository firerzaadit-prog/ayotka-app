"use client";

import { use } from "react";
import { EditQuestionPage } from "@/components/soal/edit-question-page";

export default function Page({
  params,
}: {
  params: Promise<{ packageId: string; questionId: string }>;
}) {
  const { packageId, questionId } = use(params);
  return (
    <EditQuestionPage packageId={packageId} questionId={questionId} basePath="/admin-pusat/bank-soal" />
  );
}
