/** Indikator loading dipakai app/loading.tsx (root) & loading.tsx tiap segmen role - ditampilkan Next.js selagi segmen/halaman berikutnya masih dirender di server (mis. saat pindah dari satu link sidebar ke yang lain). */
export function RouteLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className={
        fullScreen
          ? "flex min-h-screen items-center justify-center"
          : "flex min-h-[50vh] items-center justify-center"
      }
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      <span className="sr-only">Memuat...</span>
    </div>
  );
}
