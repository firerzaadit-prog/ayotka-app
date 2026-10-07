import { MAKS_BERKAS_FOTO_BYTE, TARGET_GAMBAR_KARAKTER } from "@/lib/tutor/konstanta";

/** Galat yang pesannya aman dan ramah untuk ditampilkan langsung ke siswa. */
export class GalatFoto extends Error {}

/** Ukuran baru dengan sisi terpanjang paling besar `sisiMaks`, rasio tetap. Tidak pernah memperbesar foto. */
export function hitungUkuran(lebar: number, tinggi: number, sisiMaks: number): { lebar: number; tinggi: number } {
  const sisi = Math.max(lebar, tinggi);
  if (sisi <= sisiMaks) return { lebar, tinggi };
  const skala = sisiMaks / sisi;
  return { lebar: Math.max(1, Math.round(lebar * skala)), tinggi: Math.max(1, Math.round(tinggi * skala)) };
}

/**
 * Susutkan foto coretan di peramban menjadi JPEG data URI yang pasti lolos batas server (badan permintaan di bawah
 * 1 MB): sisi terpanjang 1280 px, mutu diturunkan bertahap, lalu ukuran diperkecil bila masih terlalu besar. Latar
 * putih disisipkan supaya PNG transparan tidak berubah jadi hitam. Foto selalu diolah ulang menjadi JPEG, sehingga
 * apa pun jenis berkas aslinya, yang dikirim hanya gambar JPEG yang valid.
 */
export async function kompresGambar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new GalatFoto("Pilih berkas foto (JPG, PNG, atau WebP).");
  if (file.size > MAKS_BERKAS_FOTO_BYTE) throw new GalatFoto("Ukuran foto maksimal 15 MB.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new GalatFoto("Foto tidak bisa dibuka. Gunakan JPG, PNG, atau WebP.");
  }

  try {
    let sisi = 1280;
    for (let putaran = 0; putaran < 5; putaran++) {
      const { lebar, tinggi } = hitungUkuran(bitmap.width, bitmap.height, sisi);
      const kanvas = document.createElement("canvas");
      kanvas.width = lebar;
      kanvas.height = tinggi;
      const ctx = kanvas.getContext("2d");
      if (!ctx) throw new GalatFoto("Peramban ini tidak bisa memproses foto.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, lebar, tinggi);
      ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
      for (const mutu of [0.82, 0.7, 0.58, 0.46]) {
        const uri = kanvas.toDataURL("image/jpeg", mutu);
        if (uri.length <= TARGET_GAMBAR_KARAKTER) return uri;
      }
      sisi = Math.round(sisi * 0.75);
    }
  } finally {
    bitmap.close();
  }
  throw new GalatFoto("Foto terlalu besar untuk dikirim. Coba foto yang lebih sederhana atau lebih dekat ke tulisan.");
}
