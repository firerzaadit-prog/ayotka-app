import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Tiket 6.3: bukti transfer bisa berisi info rekening pribadi siswa - beda
 * dari lib/supabase/storage.ts (bucket "soal-media") yang publik, bucket ini
 * PRIVATE. Admin pusat melihatnya lewat signed URL berumur pendek (lihat
 * getBuktiTransferSignedUrl), bukan URL publik permanen.
 */
export const MAX_BUKTI_BYTES = 5 * 1024 * 1024;
export const ALLOWED_BUKTI_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

const BUCKET = "bukti-transfer";

async function ensureBucketExists(): Promise<void> {
  const admin = createAdminClient();
  const { data: buckets } = await admin.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;

  await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BUKTI_BYTES,
  });
}

export async function uploadBuktiTransfer(
  file: File,
  userId: string,
): Promise<{ path: string } | { error: string }> {
  if (!ALLOWED_BUKTI_TYPES.includes(file.type)) {
    return { error: "Hanya file gambar (PNG/JPEG/WEBP) atau PDF yang diperbolehkan." };
  }
  if (file.size > MAX_BUKTI_BYTES) {
    return { error: "Ukuran file melebihi 5 MB." };
  }

  await ensureBucketExists();

  const admin = createAdminClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return { error: `Gagal mengunggah file: ${error.message}` };
  }

  return { path };
}

/** Tiket 6.4: admin pusat lihat bukti transfer lewat signed URL berumur 5 menit, bukan URL publik. */
export async function getBuktiTransferSignedUrl(path: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 5 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}
