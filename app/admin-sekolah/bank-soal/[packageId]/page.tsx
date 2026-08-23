"use client";

import { use } from "react";
import { PackageDetail } from "@/components/soal/package-detail";

export default function Page({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = use(params);
  return <PackageDetail packageId={packageId} basePath="/admin-sekolah/bank-soal" />;
}
