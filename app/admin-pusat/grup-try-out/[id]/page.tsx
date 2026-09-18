"use client";

import { use } from "react";
import { GrupTryOutDetail } from "@/components/grup-try-out/grup-detail";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <GrupTryOutDetail groupId={id} />;
}
