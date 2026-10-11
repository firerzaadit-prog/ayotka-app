/**
 * Menu samping di layar kecil adalah laci yang dibuka tombol menu. Setelah pengguna mengetuk salah satu tautannya, halaman
 * berganti tetapi kerangka (layout) tetap terpasang, sehingga laci tidak menutup sendiri dan tampak seolah ketukan itu
 * tidak berefek. Fungsi murni ini memutuskan apakah sebuah klik berasal dari sebuah tautan di dalam menu (target klik bisa
 * berupa elemen di dalam <a>, mis. <span> teks menu); dipisah dari komponen supaya bisa dites tanpa DOM.
 */
export type TargetKlik = { closest?: (selector: string) => unknown } | null | undefined;

export function klikDiTautan(target: TargetKlik): boolean {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(target.closest("a[href]"));
}
