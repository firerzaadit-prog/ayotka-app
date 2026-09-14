/**
 * Nomor sementara (belum ada form/CRM pendaftaran minat sekolah) - CTA
 * "Hubungi untuk sekolah" & "Saya guru / dari sekolah" di homepage diarahkan
 * ke sini dulu (keputusan user).
 */
const WHATSAPP_NUMBER = "6282233532724";

export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
