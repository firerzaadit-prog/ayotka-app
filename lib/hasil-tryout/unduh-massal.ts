import { buatZip, namaUnik } from "@/lib/hasil-tryout/zip";

/**
 * Unduh banyak rapor PDF sekaligus sebagai satu ZIP, dikerjakan di PERAMBAN: tiap rapor diminta lewat rute rapor yang sudah
 * ada (/api/siswa/attempts/{id}/rapor), satu permintaan per PDF, lalu digabung menjadi ZIP di peramban. Dengan begitu tidak
 * ada satu permintaan server yang lama (puluhan PDF dalam satu permintaan berisiko habis waktu di nginx), kemajuan bisa
 * ditampilkan, satu rapor yang gagal tidak menggagalkan yang lain, dan bisa dibatalkan. Murni terhadap `ambil` (bisa diganti
 * di tes), jadi tidak bergantung pada React atau peramban.
 */
export type ItemUnduh = { attemptId: string; nama: string };
export type KegagalanUnduh = { nama: string; alasan: string };
export type KemajuanUnduh = { selesai: number; total: number; berhasil: number; gagal: number };
export type HasilUnduhMassal = { zip: Uint8Array | null; berhasil: number; gagal: KegagalanUnduh[]; dibatalkan: boolean };

/** Batas jumlah rapor dalam satu ZIP (lebih banyak: sempitkan dulu menurut jenis try out). */
export const MAKS_BERKAS_UNDUH_MASSAL = 150;
/** Dua permintaan sekaligus: lebih cepat dari satu-satu, tanpa membebani server dengan puluhan PDF serentak. */
export const PARALEL_BAWAAN = 2;
const PERCOBAAN_ULANG = 2;

type Pengambil = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<unknown>;
  headers: { get(nama: string): string | null };
}>;

/** Nama berkas dari header Content-Disposition (filename="..." atau filename=...); null bila tidak ada. */
export function namaDariKepala(kepala: string | null): string | null {
  if (!kepala) return null;
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(kepala);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]!.trim());
  } catch {
    return m[1]!.trim();
  }
}

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));
const adalahPdf = (b: Uint8Array) => b.length > 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;

export async function unduhMassal(
  items: ItemUnduh[],
  opsi: {
    ambil?: Pengambil;
    paralel?: number;
    sinyal?: AbortSignal;
    padaKemajuan?: (k: KemajuanUnduh) => void;
    /** Jeda sebelum mencoba ulang (ms); diganti 0 di tes. */
    jedaUlang?: number;
    sekarang?: Date;
  } = {},
): Promise<HasilUnduhMassal> {
  const ambil: Pengambil = opsi.ambil ?? ((url, init) => fetch(url, init));
  const paralel = Math.max(1, opsi.paralel ?? PARALEL_BAWAAN);
  const jedaUlang = opsi.jedaUlang ?? 800;
  const hasil: Array<{ nama: string; isi: Uint8Array } | null> = items.map(() => null);
  const gagal: KegagalanUnduh[] = [];
  let berikut = 0;
  let selesai = 0;
  let berhasil = 0;
  const batal = () => opsi.sinyal?.aborted === true;

  const lapor = () => opsi.padaKemajuan?.({ selesai, total: items.length, berhasil, gagal: gagal.length });

  async function satu(indeks: number): Promise<void> {
    const item = items[indeks]!;
    let alasan = "Gagal diunduh.";
    for (let coba = 0; coba <= PERCOBAAN_ULANG; coba++) {
      if (batal()) return;
      try {
        const res = await ambil(`/api/siswa/attempts/${encodeURIComponent(item.attemptId)}/rapor`, { signal: opsi.sinyal });
        if (res.ok) {
          const isi = new Uint8Array(await res.arrayBuffer());
          if (!adalahPdf(isi)) {
            alasan = "Jawaban server bukan berkas PDF.";
            break;
          }
          hasil[indeks] = { nama: namaDariKepala(res.headers.get("content-disposition")) ?? `Rapor-${item.nama}.pdf`, isi };
          berhasil++;
          return;
        }
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        alasan = json?.error ?? `Server menjawab ${res.status}.`;
        // 4xx (selain 429) tidak akan berhasil bila diulang: rapor ini memang tidak boleh/tidak ada.
        if (res.status < 500 && res.status !== 429) break;
      } catch (e) {
        if (batal()) return;
        alasan = e instanceof Error && e.message ? "Koneksi terputus." : "Gagal diunduh.";
      }
      if (coba < PERCOBAAN_ULANG) await tidur(jedaUlang * (coba + 1));
    }
    gagal.push({ nama: item.nama, alasan });
  }

  async function pekerja(): Promise<void> {
    while (!batal()) {
      const indeks = berikut++;
      if (indeks >= items.length) return;
      await satu(indeks);
      if (batal()) return;
      selesai++;
      lapor();
    }
  }

  lapor();
  await Promise.all(Array.from({ length: Math.min(paralel, items.length) }, () => pekerja()));

  if (batal()) return { zip: null, berhasil, gagal, dibatalkan: true };
  const sukses = hasil.filter((h): h is { nama: string; isi: Uint8Array } => h !== null);
  if (sukses.length === 0) return { zip: null, berhasil: 0, gagal, dibatalkan: false };
  const nama = namaUnik(sukses.map((h) => h.nama));
  const zip = buatZip(sukses.map((h, i) => ({ nama: nama[i]!, isi: h.isi })), opsi.sekarang);
  return { zip, berhasil: sukses.length, gagal, dibatalkan: false };
}
