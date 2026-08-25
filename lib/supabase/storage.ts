import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** Tiket 8.2: nama ekstensi diturunkan dari MIME type yang SUDAH divalidasi,
 * bukan dari file.name (bisa dipalsukan klien) - mencegah nilai aneh masuk
 * ke object key di Storage. */
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadQuestionImage(
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Hanya file gambar (PNG/JPEG/WEBP/GIF) yang diperbolehkan." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Ukuran file melebihi 5 MB." };
  }

  await ensureBucketExists();

  const admin = createAdminClient();
  const path = `${crypto.randomUUID()}.${EXT_BY_MIME[file.type]}`;

  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return { error: `Gagal mengunggah file: ${error.message}` };
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
