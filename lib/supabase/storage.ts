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
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;

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
