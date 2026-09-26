import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffGambar } from "@/lib/soal/gambar-format";

/** Bagian 9 brief: maks. 5 MB per file, hanya tipe gambar. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const BUCKET = "soal-media";

async function ensureBucketExists(): Promise<void> {
  const admin = createAdminClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;

  await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_IMAGE_BYTES,
  });
}

export async function uploadQuestionImage(
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Hanya file gambar (PNG/JPEG/WEBP/GIF) yang diperbolehkan." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Ukuran file melebihi 5 MB." };
  }
  // file.type cuma label dari browser (bisa dipalsukan). Isi file dicek juga
  // lewat magic bytes, sama seperti gambar impor Excel - file HTML/skrip yang
  // diberi label image/png tidak ikut tersimpan di bucket publik.
  const info = sniffGambar(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!info) {
    return { error: "Isi file bukan gambar PNG/JPEG/WEBP/GIF yang valid." };
  }

  await ensureBucketExists();

  const admin = createAdminClient();
  const path = `${crypto.randomUUID()}.${info.ext}`;

  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: info.mime,
    upsert: false,
  });

  if (error) {
    return { error: `Gagal mengunggah file: ${error.message}` };
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/**
 * Impor Excel: nama file diturunkan dari ISI gambar (sha256) - gambar yang sama
 * selalu menghasilkan URL yang sama. Dua manfaat: mengimpor ulang file yang
 * sama tidak menumpuk file, dan teks soal (yang memuat URL-nya) tetap identik
 * sehingga pengecekan soal ganda saat impor ulang tetap bekerja.
 */
export function importImagePath(sha256: string, ext: string): string {
  return `impor/${sha256}.${ext}`;
}

/** URL publik dihitung lokal dari path (tanpa panggilan jaringan), jadi bisa dipakai sebelum gambar benar-benar diunggah. */
export function publicImageUrl(path: string): string {
  return createAdminClient().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadImportImages(
  items: Array<{ path: string; bytes: Buffer; mime: string }>,
): Promise<{ error: string } | null> {
  if (items.length === 0) return null;
  await ensureBucketExists();
  const admin = createAdminClient();

  let next = 0;
  let firstError: string | null = null;
  const worker = async () => {
    while (firstError === null) {
      const item = items[next++];
      if (!item) return;
      // upsert: isi file sama persis dengan yang mungkin sudah ada di path itu, jadi menimpa aman.
      const { error } = await admin.storage.from(BUCKET).upload(item.path, item.bytes, { contentType: item.mime, upsert: true });
      if (error) firstError ??= error.message;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
  return firstError ? { error: firstError } : null;
}
