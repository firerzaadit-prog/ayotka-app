const MAKS_KUNCI_DATA = 30;
const MAKS_PANJANG_NILAI = 200;

/**
 * Salinan ringkas data mentah panggilan untuk audit log: paling banyak 30 kunci, nilai dipotong 200 karakter, objek
 * bersarang dijadikan teks JSON. Rahasia webhook sudah dibuang oleh pembacanya sebelum sampai sini.
 */
export function ringkasDataDiterima(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const hasil: Record<string, string> = {};
  for (const [kunci, nilai] of Object.entries(raw as Record<string, unknown>).slice(0, MAKS_KUNCI_DATA)) {
    if (kunci.toLowerCase() === "token") continue;
    let teks: string;
    try {
      teks = typeof nilai === "string" ? nilai : JSON.stringify(nilai) ?? String(nilai);
    } catch {
      teks = String(nilai);
    }
    hasil[kunci] = teks.length > MAKS_PANJANG_NILAI ? `${teks.slice(0, MAKS_PANJANG_NILAI)}...` : teks;
  }
  return Object.keys(hasil).length > 0 ? hasil : null;
}
