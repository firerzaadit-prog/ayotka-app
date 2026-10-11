import { AMBANG_TANPA_BATAS_HARI } from "@/lib/tutor/konstanta";

/**
 * Kalimat lama simpan percakapan Tanya Tutor AI untuk siswa. Harus selalu sesuai dengan HARI_SIMPAN_RIWAYAT yang
 * sebenarnya dipakai server: tanpa batas waktu (>= AMBANG_TANPA_BATAS_HARI) tidak boleh menjanjikan penghapusan otomatis
 * atau menyebut angka puluhan ribu hari; dengan batas yang nyata, menyebut jumlah hari dan penghapusan otomatisnya.
 */
export function KeteranganLamaSimpan({ hariSimpan }: { hariSimpan: number }) {
  if (hariSimpan >= AMBANG_TANPA_BATAS_HARI) {
    return (
      <>
        Percakapan ini disimpan agar bisa kamu lanjutkan kapan saja. Kamu bisa menghapusnya sendiri lewat tombol{" "}
        <b>Hapus percakapan</b>.
      </>
    );
  }
  return (
    <>
      Percakapan ini disimpan <b>{hariSimpan} hari</b> sejak dikirim agar bisa kamu lanjutkan, lalu dihapus otomatis.
    </>
  );
}
