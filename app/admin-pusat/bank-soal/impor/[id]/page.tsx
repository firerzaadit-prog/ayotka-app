"use client";

import { use } from "react";
import { ImportPreview } from "@/components/soal-import/import-preview";

export default function AdminPusatSoalImportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ImportPreview paketId={id} />;
}
