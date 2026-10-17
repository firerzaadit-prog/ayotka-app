/**
 * Menentukan data "asal sekolah" yang dikirim formulir pendaftaran siswa mandiri. Murni (tanpa React) supaya aturannya
 * diuji tabel kasus.
 *
 * Satu kolom isian: sekolah yang DIPILIH dari daftar dipakai sebagai sekolah terdaftar (hanya id yang dikirim). Bila tidak
 * ada yang dipilih, nama yang DIKETIK langsung dipakai sebagai sekolah baru (asalSekolahManual) tanpa tombol tambahan
 * (permintaan user, 16 Okt 2026), dengan kota/kabupaten dan negeri/swasta wajib supaya nilai siswa bisa dipetakan per
 * wilayah (aturan server: lihat daftarMandiriSchema). Server tetap yang memutuskan: nama yang sama di jenjang dan
 * kota/kabupaten yang sama memakai baris sekolah yang sudah ada, bukan membuat ganda.
 */
export const PANJANG_MIN_NAMA_SEKOLAH = 3;
export const PANJANG_MAKS_NAMA_SEKOLAH = 120;

/** Nama sekolah dirapikan: spasi di ujung dibuang dan spasi ganda/baris baru menjadi satu spasi. */
export function rapikanNamaSekolah(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export type PilihanAsalSekolah = {
  /** Sekolah yang dipilih dari daftar pencarian; null bila tidak ada yang dipilih. */
  dipilihId: string | null;
  /** Isi kolom Asal sekolah apa adanya. */
  teksDiketik: string;
  provinsi: string;
  kabupatenKota: string;
  /** "negeri" / "swasta" / "" (belum dipilih). */
  status: string;
};

export type DataAsalSekolah = {
  asalSekolahId: string;
  asalSekolahManual: string;
  asalSekolahProvinsi: string;
  asalSekolahKabupatenKota: string;
  asalSekolahStatus: string;
};

export function bentukDataAsalSekolah(
  p: PilihanAsalSekolah,
): { ok: true; data: DataAsalSekolah } | { ok: false; error: string } {
  if (p.dipilihId) {
    // Sekolah yang dipilih sudah tercatat lengkap: isian manual (kalau ada sisa dari sebelumnya) tidak ikut dikirim.
    return {
      ok: true,
      data: { asalSekolahId: p.dipilihId, asalSekolahManual: "", asalSekolahProvinsi: "", asalSekolahKabupatenKota: "", asalSekolahStatus: "" },
    };
  }

  const nama = rapikanNamaSekolah(p.teksDiketik);
  if (nama.length < PANJANG_MIN_NAMA_SEKOLAH) {
    return {
      ok: false,
      error:
        "Isi asal sekolahmu: ketik namanya (minimal 3 huruf) lalu pilih dari daftar yang muncul. Kalau tidak ada di daftar, nama yang kamu ketik langsung dipakai.",
    };
  }
  if (nama.length > PANJANG_MAKS_NAMA_SEKOLAH) {
    return { ok: false, error: `Nama sekolah maksimal ${PANJANG_MAKS_NAMA_SEKOLAH} karakter.` };
  }
  if (!p.provinsi || !p.kabupatenKota) return { ok: false, error: "Pilih provinsi dan kota/kabupaten sekolahmu." };
  if (p.status !== "negeri" && p.status !== "swasta") return { ok: false, error: "Pilih apakah sekolahmu negeri atau swasta." };

  return {
    ok: true,
    data: {
      asalSekolahId: "",
      asalSekolahManual: nama,
      asalSekolahProvinsi: p.provinsi,
      asalSekolahKabupatenKota: p.kabupatenKota,
      asalSekolahStatus: p.status,
    },
  };
}

/** Blok kota/kabupaten + negeri/swasta ditampilkan selama ada nama yang bisa dipakai dan tidak ada sekolah yang dipilih. */
export function perluLengkapiSekolahBaru(dipilihId: string | null, teksDiketik: string): boolean {
  return !dipilihId && rapikanNamaSekolah(teksDiketik).length >= PANJANG_MIN_NAMA_SEKOLAH;
}
