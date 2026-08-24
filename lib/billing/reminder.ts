import type { Subscription } from "@prisma/client";
import { formatWIBDate, tanggalWIB } from "@/lib/utils/datetime";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderKind = "H-7" | "H-3" | "H-0";

/**
 * Tiket 6.9 (Bagian 7.1 brief, "Pengingat"): H-7, H-3, H-0 sebelum
 * kedaluwarsa. Dibandingkan sebagai TANGGAL KALENDER WIB (bukan selisih
 * milidetik mentah) - supaya subscription yang berakhir jam berapa pun di
 * hari itu tetap kena reminder yang sama, tidak meleset sehari gara-gara
 * jam cron jalan vs jam berakhir_at beda.
 */
export function matchReminderKind(berakhirAt: Date, now: Date = new Date()): ReminderKind | null {
  const tanggalBerakhir = tanggalWIB(berakhirAt);
  if (tanggalBerakhir === tanggalWIB(now)) return "H-0";
  if (tanggalBerakhir === tanggalWIB(new Date(now.getTime() + 3 * DAY_MS))) return "H-3";
  if (tanggalBerakhir === tanggalWIB(new Date(now.getTime() + 7 * DAY_MS))) return "H-7";
  return null;
}

const REMINDER_LABEL: Record<ReminderKind, string> = {
  "H-7": "7 hari lagi",
  "H-3": "3 hari lagi",
  "H-0": "hari ini",
};

export function buildBillingReminderEmail(
  kind: ReminderKind,
  info: Pick<Subscription, "berakhirAt"> & { planNama: string },
): { subject: string; text: string } {
  const tanggal = formatWIBDate(info.berakhirAt);
  const subject =
    kind === "H-0"
      ? "Langgananmu di AyoTKA berakhir hari ini"
      : `Langgananmu di AyoTKA akan berakhir ${REMINDER_LABEL[kind]}`;

  const text = [
    `Halo,`,
    ``,
    kind === "H-0"
      ? `Langganan paket "${info.planNama}" kamu berakhir HARI INI (${tanggal}).`
      : `Langganan paket "${info.planNama}" kamu akan berakhir ${REMINDER_LABEL[kind]}, pada ${tanggal}.`,
    ``,
    `Setelah berakhir, kamu masih punya masa tenggang 3 hari dengan akses penuh sebelum "mulai ujian baru" terkunci. Riwayat nilai, pembahasan, dan analisis AI-mu tetap bisa dibuka kapan saja.`,
    ``,
    `Untuk memperpanjang, transfer manual ke rekening tujuan di halaman Langganan lalu unggah bukti transfer - admin kami akan memverifikasi dan mengaktifkan kembali akunmu.`,
    ``,
    `Terima kasih,`,
    `Tim AyoTKA`,
  ].join("\n");

  return { subject, text };
}
