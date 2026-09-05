import { AnalitikGlobalView } from "@/components/analytics/analitik-global-view";

/** Tiket 7.1 (Bagian 5 brief, "Analitik Global") - lihat components/analytics/analitik-global-view.tsx. */
export default function AnalitikGlobalPage() {
  return (
    <AnalitikGlobalView
      analitikEndpoint="/api/admin-pusat/analitik"
      schoolsEndpoint="/api/admin-pusat/schools"
      subjectsEndpoint="/api/admin-pusat/subjects"
    />
  );
}
