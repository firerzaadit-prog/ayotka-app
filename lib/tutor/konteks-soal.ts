import { shuffleWithSeed } from "@/lib/exam/shuffle";
import { MAKS_TEKS_OPSI, MAKS_TEKS_SOAL, MAKS_TEKS_STIMULUS } from "@/lib/tutor/konstanta";

/** Bentuk `soalContext` yang diterima API Tutor AI (lihat docs/INTEGRASI_TUTOR_AI_UNTUK_FIRERZA.md di repo generator soal). */
export type KonteksTutor = {
  jenjang: string;
  mapel: string;
  stimulus?: string;
  soal_text: string;
  opsi?: Array<{ label: string; text: string }>;
  kunci_jawaban?: string | string[];
  pembahasan?: string;
  jawaban_siswa?: string;
  mode: "socratic";
};

export type SoalUntukTutor = {
  id: string;
  format: "pg" | "pg_kompleks" | "pg_kategori";
  teks: string;
  pembahasan: string | null;
  options: Array<{ id: string; teks: string; isCorrect: boolean; urutan: number }>;
  statements: Array<{ id: string; teks: string; correctCategoryId: string; urutan: number }>;
  categories: Array<{ id: string; label: string; urutan: number }>;
  stimulus: { konten: string; judul: string | null } | null;
};

const potong = (teks: string, maks: number) => (teks.length > maks ? `${teks.slice(0, maks)}...` : teks);
const urut = <T extends { urutan: number }>(daftar: T[]) => [...daftar].sort((a, b) => a.urutan - b.urutan);
const huruf = (indeks: number) => String.fromCharCode(65 + indeks);

/** Jawaban siswa sebagai objek bila bentuknya masuk akal, selain itu null (kosong, rusak, atau bukan objek). */
function sebagaiObjek(jawabanJson: unknown): Record<string, unknown> | null {
  return jawabanJson !== null && typeof jawabanJson === "object" && !Array.isArray(jawabanJson)
    ? (jawabanJson as Record<string, unknown>)
    : null;
}

/**
 * Susun konteks soal untuk Tutor AI dari data di DATABASE KITA (bukan dari kiriman peramban): kunci jawaban dan
 * pembahasan tidak pernah berasal dari klien. Urutan dan label opsi/pernyataan HARUS sama persis dengan yang dilihat
 * siswa di halaman pembahasan (lib/exam/hasil.ts memakai benih acak yang sama), kalau tidak tutor akan membicarakan
 * "opsi B" yang bagi siswa adalah opsi lain.
 */
export function susunKonteksTutor(input: {
  attemptId: string;
  acakOpsi: boolean;
  jenjang: string;
  mapel: string;
  soal: SoalUntukTutor;
  jawabanJson: unknown;
}): KonteksTutor {
  const { attemptId, acakOpsi, soal } = input;
  const jawaban = sebagaiObjek(input.jawabanJson);

  const konteks: KonteksTutor = {
    jenjang: input.jenjang,
    mapel: input.mapel,
    soal_text: potong(soal.teks, MAKS_TEKS_SOAL),
    mode: "socratic",
  };
  if (soal.stimulus?.konten) {
    const judul = soal.stimulus.judul ? `${soal.stimulus.judul}\n` : "";
    konteks.stimulus = potong(`${judul}${soal.stimulus.konten}`, MAKS_TEKS_STIMULUS);
  }
  if (soal.pembahasan) konteks.pembahasan = potong(soal.pembahasan, MAKS_TEKS_SOAL);

  if (soal.format === "pg_kategori") {
    // Tiap pernyataan dikelompokkan siswa ke salah satu kategori (mis. Benar/Salah); label = nomor tampil.
    const kategori = urut(soal.categories);
    const namaKategori = new Map(kategori.map((k) => [k.id, k.label]));
    const pernyataan = shuffleWithSeed(urut(soal.statements), `${attemptId}:baris:${soal.id}`);
    konteks.opsi = pernyataan.map((p, i) => ({ label: String(i + 1), text: potong(p.teks, MAKS_TEKS_OPSI) }));
    konteks.kunci_jawaban = pernyataan.map((p, i) => `${i + 1}: ${namaKategori.get(p.correctCategoryId) ?? "-"}`);
    if (kategori.length > 0) {
      konteks.soal_text = potong(
        `${konteks.soal_text}\n\nUntuk setiap pernyataan, siswa memilih salah satu kategori: ${kategori.map((k) => k.label).join(" / ")}.`,
        MAKS_TEKS_SOAL,
      );
    }
    const dipilih = jawaban ?? {};
    if (pernyataan.some((p) => typeof dipilih[p.id] === "string" && namaKategori.has(dipilih[p.id] as string))) {
      konteks.jawaban_siswa = pernyataan
        .map((p, i) => `${i + 1}: ${namaKategori.get(dipilih[p.id] as string) ?? "(kosong)"}`)
        .join("; ");
    }
    return konteks;
  }

  const diurutkan = urut(soal.options);
  const opsi = acakOpsi ? shuffleWithSeed(diurutkan, `${attemptId}:opsi:${soal.id}`) : diurutkan;
  const label = new Map(opsi.map((o, i) => [o.id, huruf(i)]));
  konteks.opsi = opsi.map((o, i) => ({ label: huruf(i), text: potong(o.teks, MAKS_TEKS_OPSI) }));

  const kunci = opsi.filter((o) => o.isCorrect).map((o) => label.get(o.id)!);
  if (soal.format === "pg") {
    if (kunci[0]) konteks.kunci_jawaban = kunci[0];
    const terpilih = typeof jawaban?.option_id === "string" ? label.get(jawaban.option_id) : undefined;
    if (terpilih) konteks.jawaban_siswa = terpilih;
  } else {
    // `kunci` sudah menaik: label diberikan menurut posisi tampil, dan opsi dilewati dari atas ke bawah.
    if (kunci.length > 0) konteks.kunci_jawaban = kunci;
    const ids = Array.isArray(jawaban?.option_ids) ? (jawaban.option_ids as unknown[]) : [];
    const terpilih = ids.map((id) => (typeof id === "string" ? label.get(id) : undefined)).filter((l): l is string => !!l);
    if (terpilih.length > 0) konteks.jawaban_siswa = [...terpilih].sort().join(", ");
  }
  return konteks;
}
