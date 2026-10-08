import { requireRole } from "@/lib/auth/session";
import { getDinasWilayah } from "@/lib/dinas/wilayah";
import { AnalitikGlobalView } from "@/components/analytics/analitik-global-view";

export const dynamic = "force-dynamic";

/** Analitik Global dinas pendidikan - lihat components/analytics/analitik-global-view.tsx. */
export default async function DinasPendidikanAnalitikPage() {
  const user = await requireRole("dinas_pendidikan");
  const cakupan = await getDinasWilayah(user.id);
  return (
    <AnalitikGlobalView
      analitikEndpoint="/api/dinas-pendidikan/analitik"
      schoolsEndpoint="/api/dinas-pendidikan/schools"
      subjectsEndpoint="/api/admin-pusat/subjects"
      cakupan={cakupan}
    />
  );
}
