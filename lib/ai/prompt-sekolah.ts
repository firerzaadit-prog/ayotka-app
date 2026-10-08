import { formatPersen } from "@/lib/indikator/tampilan";
import { type LaporanIndikatorSekolah } from "@/lib/indikator/daya-serap";

export type PromptInputSekolah = {
  namaSekolah: string;
  namaMapel: string;
  jumlahSiswaMengerjakan: number;
  jumlahPaket: number;
  periodeLabel: string;
  laporan: LaporanIndikatorSekolah;
  wawasan: { jenis: string; teks: string }[];
};

export function buildAnalisisSekolahPrompt(input: PromptInputSekolah): string {
  const lap = input.laporan;
  
  const sebaranTeks = `Siswa Baik (70% ke atas): ${lap.sebaran.baik} siswa
Siswa Cukup (50-69%): ${lap.sebaran.cukup} siswa
Siswa Kurang (di bawah 50%): ${lap.sebaran.kurang} siswa`;

  const kelompokTeks = lap.kelompok
    .map(k => {
      let txt = `- ${k.nama}: Daya Serap ${formatPersen(k.dayaSerap, 1)} (Nasional: ${k.nasional ? formatPersen(k.nasional, 1) : '-'})`;
      k.baris.forEach(b => {
        txt += `\n  * Indikator "${b.indikator}": ${formatPersen(b.dayaSerap, 1)} (Nasional: ${b.nasional ? formatPersen(b.nasional, 1) : '-'})`;
      });
      return txt;
    })
    .join("\n");

  const wawasanTeks = input.wawasan.map(w => `- [${w.jenis}] ${w.teks}`).join("\n");

  const remedialTeks = lap.prioritasRemedial.map(b => `- ${b.indikator}: ${formatPersen(b.dayaSerap, 1)} (${b.jmlSiswa} siswa, ${b.jmlSoal} jawaban)`).join("\n");
  
  const bawahNasionalTeks = lap.diBawahNasional.map(b => `- ${b.indikator}: ${formatPersen(b.dayaSerap, 1)} vs Nasional ${b.nasional ? formatPersen(b.nasional, 1) : '-'}`).join("\n");

  return `Kamu adalah seorang analis pendidikan ahli yang menganalisis daya serap siswa sebuah sekolah secara agregat berdasarkan hasil try out. Susun analisis ini untuk Kepala Sekolah dan Guru mata pelajaran bersangkutan menggunakan Bahasa Indonesia baku, santun, objektif, dan suportif.

ATURAN WAJIB:
- Analisis ini ditujukan kepada Admin Sekolah / Guru.
- Semua angka dan data di bawah ini SUDAH FINAL. Jangan menghitung ulang atau menebak angka baru.
- HANYA bahas indikator dan materi yang tercantum dalam data di bawah.
- Berikan wawasan yang bermakna bagi guru: mana kelompok materi yang aman, dan mana yang paling mendesak butuh remedial.
- Keluarkan HANYA JSON sesuai skema yang diminta, tanpa teks tambahan.

DATA SEKOLAH:
Nama Sekolah: ${input.namaSekolah}
Mata Pelajaran: ${input.namaMapel}
Periode: ${input.periodeLabel}
Jumlah Siswa Mengerjakan: ${input.jumlahSiswaMengerjakan} (dari ${input.jumlahPaket} paket ujian)

SEBARAN KEMAMPUAN SISWA:
${sebaranTeks}

DAYA SERAP PER KELOMPOK & INDIKATOR RESMI:
${kelompokTeks || "(tidak ada data indikator resmi)"}

WAWASAN (Dihasilkan oleh sistem):
${wawasanTeks || "(tidak ada wawasan)"}

PRIORITAS REMEDIAL (Indikator paling butuh perhatian):
${remedialTeks || "(tidak ada prioritas remedial)"}

INDIKATOR DI BAWAH NASIONAL:
${bawahNasionalTeks || "(tidak ada)"}

Sebagai ahli, susun analisis dalam format JSON dengan bagian berikut:
1. "ringkasan": Ringkasan performa daya serap sekolah ini secara agregat (2-3 kalimat).
2. "kelebihanSekolah": Jelaskan indikator/materi yang daya serapnya sudah melampaui nasional atau berada di tingkat 'Baik'.
3. "kekuranganSekolah": Jelaskan area paling krusial yang jadi kelemahan sekolah ini, merujuk langsung ke Prioritas Remedial.
4. "rekomendasi": 3-5 langkah tindak lanjut bagi guru untuk memperbaiki area yang lemah (strategi pengajaran atau fokus remedial materi tertentu).`;
}
