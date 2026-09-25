"use client";

import { use } from "react";
import { PembahasanEditor } from "@/components/soal/pembahasan-editor";

export default function Page({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = use(params);
  return <PembahasanEditor packageId={packageId} basePath="/admin-pusat/bank-soal" />;
}
