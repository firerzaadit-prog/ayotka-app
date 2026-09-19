import "server-only";
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const SALT = "ayotka-settings-salt-2026";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret =
    process.env.APP_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "ayotka-master-platform-key-fallback-32b";
  return crypto.scryptSync(secret, SALT, 32);
}

/**
 * Enkripsi kunci rahasia menggunakan AES-256-GCM.
 * Menghasilkan string berformat iv:authTag:ciphertext (dalam hex).
 */
export function encryptSecret(plainText: string): string {
  if (!plainText || !plainText.trim()) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText.trim(), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Dekripsi kunci rahasia yang tersimpan di database.
 * Jika format salah atau gagal didekripsi, kembalikan string kosong secara aman.
 */
export function decryptSecret(cipherText: string | null | undefined): string {
  if (!cipherText || !cipherText.trim()) return "";
  const parts = cipherText.trim().split(":");
  if (parts.length !== 3) {
    // Kalau kebetulan nilai tersimpan masih plaintext lama
    return cipherText;
  }

  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex!, "hex");
    const authTag = Buffer.from(authTagHex!, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex!, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return "";
  }
}

/**
 * Samarkan kunci rahasia untuk ditampilkan aman di browser Admin Pusat.
 * Contoh: "AIzaSyD8...••••••••" atau "••••••••" jika pendek.
 */
export function maskSecret(plainText: string | null | undefined): string {
  if (!plainText || !plainText.trim()) return "";
  const clean = plainText.trim();
  if (clean.length <= 8) {
    return "••••••••";
  }
  const prefix = clean.slice(0, 6);
  const suffix = clean.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Deteksi apakah input dari form adalah placeholder sensor (tidak diubah user).
 */
export function isMaskedPlaceholder(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes("••••");
}
