import { AnalitikGlobalView } from "@/components/analytics/analitik-global-view";

/** Analitik Global dinas pendidikan - lihat components/analytics/analitik-global-view.tsx. */
export default function DinasPendidikanAnalitikPage() {
  return (
    <AnalitikGlobalView
      analitikEndpoint="/api/dinas-pendidikan/analitik"
      schoolsEndpoint="/api/dinas-pendidikan/schools"
      subjectsEndpoint="/api/admin-pusat/subjects"
    />
  );
}
