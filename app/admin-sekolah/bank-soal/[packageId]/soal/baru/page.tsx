"use client";

import { use } from "react";
import { NewQuestionPage } from "@/components/soal/new-question-page";

export default function Page({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = use(params);
  return <NewQuestionPage packageId={packageId} basePath="/admin-sekolah/bank-soal" />;
}
