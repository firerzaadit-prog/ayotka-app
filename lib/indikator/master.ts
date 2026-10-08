import { z } from "zod";
import { labelElemenTampil } from "@/lib/content/label-elemen";
import { kunciTeksIndikator } from "./normalisasi";

/**
 * Berkas master indikator resmi Pusmendik Kemendikdasmen (kemendikdasmen-official.json milik generator soal.ayotka.id):
 * larik objek { jenjang, kd_mapel, nama_mapel, elemen, subelemen, kompetensi, subkompetensi?, indikator, urutan,
 * nilai_nasional }. Modul ini murni (tanpa database) supaya validasinya mudah diuji.
 */
export const MAKS_BARIS_MASTER = 2000;
const MAKS_GALAT_DITAMPILKAN = 20;

export type JenjangMaster = "SD" | "SMP" | "SMA";

export interface BarisMaster {
  jenjang: JenjangMaster;
  kdMapel: string;
  namaMapel: string;
  elemen: string;
  subelemen: string;
  kompetensi: string;
  subkompetensi: string | null;
  indikator: string;
  teksKunci: string;
  urutan: number;
  nilaiNasional: number | null;
}

const teksWajib = (maks: number) =>
  z.string({ error: "wajib diisi berupa teks" }).trim().min(1, "tidak boleh kosong").max(maks, `terlalu panjang (maks ${maks} karakter)`);

const BarisSchema = z.object({
  jenjang: z.enum(["SD", "SMP", "SMA"], { error: 'harus "SD", "SMP", atau "SMA"' }),
  kd_mapel: teksWajib(40),
  nama_mapel: teksWajib(120),
  elemen: teksWajib(500),
  subelemen: teksWajib(1000),
  kompetensi: teksWajib(1000),
  subkompetensi: z.string().trim().max(1000, "terlalu panjang (maks 1000 karakter)").nullish(),
  indikator: teksWajib(1000),
  urutan: z.number({ error: "harus berupa angka" }).int("harus bilangan bulat").min(0).max(100000),
  nilai_nasional: z.number({ error: "harus berupa angka" }).min(0, "minimal 0").max(100, "maksimal 100").nullish(),
});

export type HasilParseMaster = { ok: true; baris: BarisMaster[] } | { ok: false; galat: string[] };

/** Validasi isi berkas master. Mengembalikan semua baris yang sah, atau daftar galat (paling banyak 20) bila ada yang cacat. */
export function parseMasterJson(raw: unknown): HasilParseMaster {
  if (!Array.isArray(raw)) {
    return { ok: false, galat: ["Isi berkas harus berupa larik (array) indikator."] };
  }
  if (raw.length === 0) return { ok: false, galat: ["Berkas tidak berisi indikator."] };
  if (raw.length > MAKS_BARIS_MASTER) {
    return { ok: false, galat: [`Terlalu banyak baris (${raw.length}); maksimal ${MAKS_BARIS_MASTER}.`] };
  }

  const galat: string[] = [];
  const baris: BarisMaster[] = [];
  const pertama = new Map<string, number>(); // kunci -> nomor baris pertama (untuk mendeteksi duplikat)

  raw.forEach((item, i) => {
    const nomor = i + 1;
    const hasil = BarisSchema.safeParse(item);
    if (!hasil.success) {
      for (const p of hasil.error.issues.slice(0, 3)) {
        galat.push(`Baris ${nomor}: ${p.path.join(".") || "isi"} ${p.message}`);
      }
      return;
    }
    const d = hasil.data;
    const subkompetensi = d.subkompetensi && d.subkompetensi !== "-" ? d.subkompetensi : null;
    const teksKunci = kunciTeksIndikator(d.indikator);
    const kunci = `${d.jenjang}|${d.nama_mapel.toLowerCase()}|${teksKunci}`;
    const sebelumnya = pertama.get(kunci);
    if (sebelumnya !== undefined) {
      galat.push(`Baris ${nomor}: indikator sama dengan baris ${sebelumnya} (${d.jenjang} - ${d.nama_mapel}).`);
      return;
    }
    pertama.set(kunci, nomor);
    baris.push({
      jenjang: d.jenjang,
      kdMapel: d.kd_mapel,
      namaMapel: d.nama_mapel,
      elemen: d.elemen,
      subelemen: d.subelemen,
      kompetensi: d.kompetensi,
      subkompetensi,
      indikator: d.indikator,
      teksKunci,
      urutan: d.urutan,
      nilaiNasional: d.nilai_nasional ?? null,
    });
  });

  if (galat.length > 0) {
    const lebih = galat.length - MAKS_GALAT_DITAMPILKAN;
    return {
      ok: false,
      galat: lebih > 0 ? [...galat.slice(0, MAKS_GALAT_DITAMPILKAN), `...dan ${lebih} galat lain.`] : galat,
    };
  }
  return { ok: true, baris };
}

/** Matematika punya 4 tingkat (elemen > subelemen > kompetensi > indikator); mapel bahasa 3 tingkat. */
export function jumlahTingkatHierarki(namaMapel: string): 3 | 4 {
  return /matematika/i.test(namaMapel) ? 4 : 3;
}

export interface HierarkiIndikator {
  /** Label resmi tiap tingkat, mis. ["Elemen","Subelemen","Kompetensi","Indikator"]. */
  label: string[];
  /** Nilai tiap tingkat, sejajar dengan `label`. */
  nilai: string[];
}

/**
 * Hierarki resmi sebuah indikator. Bahasa Indonesia (3 tingkat) memakai kolom elemen sebagai Kompetensi dan kolom
 * subelemen sebagai Subkompetensi - kolom `kompetensi` di master untuk mapel bahasa hanya menggandakan subelemen - dan
 * TIDAK PERNAH memunculkan label "Elemen"/"Subelemen" (panduan Pusmendik: membingungkan guru dan siswa).
 */
export function hierarkiIndikator(i: {
  jenjang: string;
  namaMapel: string;
  elemen: string;
  subelemen: string;
  kompetensi: string;
  indikator: string;
}): HierarkiIndikator {
  if (jumlahTingkatHierarki(i.namaMapel) === 4) {
    // Nama elemen ditampilkan menurut Kerangka Asesmen (SD: "Data", bukan "Data dan Ketidakpastian"); data master tetap apa adanya.
    const elemen = labelElemenTampil({ jenjang: i.jenjang, namaMapel: i.namaMapel }, i.elemen);
    return { label: ["Elemen", "Subelemen", "Kompetensi", "Indikator"], nilai: [elemen, i.subelemen, i.kompetensi, i.indikator] };
  }
  return { label: ["Kompetensi", "Subkompetensi", "Indikator"], nilai: [i.elemen, i.subelemen, i.indikator] };
}
