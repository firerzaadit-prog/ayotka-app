import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Koneksi baca-saja terpisah ke skema `soal` (soal.ayotka.id), lewat role
 * ayotka_app_reader yang cuma di-GRANT SELECT ke soal.questions,
 * soal.stimulus, soal.question_packages (dokumen Integrasi Bank Soal TKA,
 * Bagian 04-05). Sengaja TIDAK mengekspor PrismaClient-nya - client mentah
 * cuma dipakai lewat $queryRaw di file ini, supaya kode lain di ayotka-app
 * tidak bisa tidak sengaja pakai model generated (mis. sourceClient.
 * question.findMany()) yang menunjuk ke tabel ayotka-app sendiri, bukan
 * skema soal.
 */

export interface SourcePaket {
  id: string;
  code: string;
  nama: string;
  jenjang: string;
  mapel: string;
  status: string;
  jumlahSoal: number;
}

export interface SourceQuestion {
  id: string;
  code: string;
  nomorUrut: number | null;
  jenjang: string;
  mapel: string;
  elemen: string;
  subElemen: string | null;
  kompetensi: string | null;
  levelKognitif: string | null;
  tingkatKesulitan: string | null;
  bentukSoal: string;
  stimulusId: string | null;
  paketId: string | null;
  payload: SoalPayload;
}

export interface SoalPayload {
  soal_text: string;
  gambar?: {
    // "ilustrasi_kontekstual" ditemukan di data produksi (16 soal per 2026-09-23) - tidak
    // disebut di dokumen rencana Fase 4, jadi diperlakukan sama seperti "perlu_ilustrasi"
    // (diblokir dengan pesan jelas) di lib/soal-import/media.ts sampai jelas maksudnya.
    tipe: "svg" | "url" | "perlu_ilustrasi" | "ilustrasi_kontekstual";
    svg_content?: string;
    url?: string;
    deskripsi_alt: string;
  } | null;
  opsi?: Array<{ label: string; text: string }>;
  pernyataan?: Array<{ no: number; text: string }>;
  kategori_respons?: string[];
  kunci_jawaban: string[];
  pembahasan: string;
}

export interface SourceStimulus {
  id: string;
  tipe: string;
  judul: string;
  konten: string;
}

function getSourceDatabaseUrl(): string {
  const url = process.env.SOAL_SOURCE_DATABASE_URL;
  if (!url) {
    throw new Error(
      "SOAL_SOURCE_DATABASE_URL belum diset - dibutuhkan untuk membaca paket dari soal.ayotka.id (lihat .env.example).",
    );
  }
  // Sama seperti lib/db/prisma.ts: pooler Supabase (port 6543) tanpa
  // pgbouncer=true memicu error prepared-statement di Prisma.
  if (url.includes(":6543") && !url.includes("pgbouncer=true")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}pgbouncer=true`;
  }
  return url;
}

const globalForSourceDb = globalThis as unknown as {
  soalSourceClient: PrismaClient | undefined;
};

function getClient(): PrismaClient {
  if (!globalForSourceDb.soalSourceClient) {
    globalForSourceDb.soalSourceClient = new PrismaClient({
      datasources: { db: { url: getSourceDatabaseUrl() } },
    });
  }
  return globalForSourceDb.soalSourceClient;
}

/** Paket berstatus `diterbitkan` - satu-satunya status yang boleh diimpor. */
export async function listPublishedPackages(): Promise<SourcePaket[]> {
  return getClient().$queryRaw<SourcePaket[]>`
    SELECT id, code, nama, jenjang, mapel, status, jumlah_soal AS "jumlahSoal"
    FROM soal.question_packages
    WHERE status = 'diterbitkan'
    ORDER BY code ASC
  `;
}

export async function getPackageById(paketIdOrCode: string): Promise<SourcePaket | null> {
  const rows = await getClient().$queryRaw<SourcePaket[]>`
    SELECT id, code, nama, jenjang, mapel, status, jumlah_soal AS "jumlahSoal"
    FROM soal.question_packages
    WHERE id = ${paketIdOrCode} OR code = ${paketIdOrCode}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getQuestionsForPackage(paketId: string): Promise<SourceQuestion[]> {
  return getClient().$queryRaw<SourceQuestion[]>`
    SELECT
      id, code, nomor_urut AS "nomorUrut", jenjang, mapel, elemen,
      sub_elemen AS "subElemen", kompetensi, level_kognitif AS "levelKognitif",
      tingkat_kesulitan AS "tingkatKesulitan", bentuk_soal AS "bentukSoal",
      stimulus_id AS "stimulusId", paket_id AS "paketId", payload
    FROM soal.questions
    WHERE paket_id = ${paketId}
    ORDER BY nomor_urut ASC NULLS LAST
  `;
}

export async function getStimulusByIds(ids: string[]): Promise<SourceStimulus[]> {
  if (ids.length === 0) return [];
  return getClient().$queryRaw<SourceStimulus[]>(
    Prisma.sql`SELECT id, tipe, judul, konten FROM soal.stimulus WHERE id IN (${Prisma.join(ids)})`,
  );
}
