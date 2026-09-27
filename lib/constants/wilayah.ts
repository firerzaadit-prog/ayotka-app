/**
 * Daftar lengkap kota dan kabupaten di Provinsi Jawa Timur.
 * Dipakai sebagai opsi dropdown di:
 * - Form sekolah (admin pusat): pilih kota/kabupaten sekolah
 * - Form akun dinas pendidikan (admin pusat): pilih wilayah cakupan
 * - Filter data di dashboard dinas pendidikan
 *
 * Urutan: alfabet, kota didahulukan sebelum kabupaten dengan nama sama
 * (mis. "Kota Kediri" sebelum "Kabupaten Kediri").
 */
export const KABUPATEN_KOTA_JATIM = [
  "Kabupaten Bangkalan",
  "Kabupaten Banyuwangi",
  "Kabupaten Blitar",
  "Kabupaten Bojonegoro",
  "Kabupaten Bondowoso",
  "Kabupaten Gresik",
  "Kabupaten Jember",
  "Kabupaten Jombang",
  "Kabupaten Kediri",
  "Kabupaten Lamongan",
  "Kabupaten Lumajang",
  "Kabupaten Madiun",
  "Kabupaten Magetan",
  "Kabupaten Malang",
  "Kabupaten Mojokerto",
  "Kabupaten Nganjuk",
  "Kabupaten Ngawi",
  "Kabupaten Pacitan",
  "Kabupaten Pamekasan",
  "Kabupaten Pasuruan",
  "Kabupaten Ponorogo",
  "Kabupaten Probolinggo",
  "Kabupaten Sampang",
  "Kabupaten Sidoarjo",
  "Kabupaten Situbondo",
  "Kabupaten Sumenep",
  "Kabupaten Trenggalek",
  "Kabupaten Tuban",
  "Kabupaten Tulungagung",
  "Kota Batu",
  "Kota Blitar",
  "Kota Kediri",
  "Kota Madiun",
  "Kota Malang",
  "Kota Mojokerto",
  "Kota Pasuruan",
  "Kota Probolinggo",
  "Kota Surabaya",
] as const;

export type KabupatenKotaJatim = (typeof KABUPATEN_KOTA_JATIM)[number];
