import type { Metadata } from "next";
import Link from "next/link";
import { Bagian, BlokKontak, Daftar, HalamanHukum } from "@/components/public/halaman-hukum";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan - AyoTKA",
  description:
    "Aturan memakai AyoTKA: akun, penggunaan yang diperbolehkan, paket berbayar, Learning Analytics berbasis AI, dan batas tanggung jawab.",
};

export default function SyaratKetentuanPage() {
  return (
    <HalamanHukum
      judul="Syarat & Ketentuan"
      pembuka="Aturan ini berlaku saat Anda memakai AyoTKA, baik sebagai siswa, orang tua, guru, admin sekolah, dinas pendidikan, maupun mitra. Dengan membuat akun atau memakai layanan, Anda dianggap setuju."
      diperbarui="3 Oktober 2026"
    >
      <Bagian nomor={1} judul="Tentang layanan">
        <p>
          AyoTKA adalah platform latihan Tes Kemampuan Akademik (TKA) untuk siswa SD dan SMP, dikelola oleh
          Mathematics Learning Media And Technology Research Group (Maletech-RG), Departemen Matematika FMIPA UM.
          AyoTKA adalah sarana belajar mandiri dan bukan bagian dari penyelenggaraan TKA resmi. Skor latihan di AyoTKA
          tidak menjamin hasil pada TKA yang sesungguhnya.
        </p>
      </Bagian>

      <Bagian nomor={2} judul="Akun">
        <Daftar
          items={[
            "Isilah data pendaftaran dengan benar. Siswa SD dan SMP sebaiknya mendaftar bersama orang tua atau wali.",
            "Jaga kerahasiaan kata sandi. Semua kegiatan lewat akun Anda menjadi tanggung jawab Anda.",
            "Satu akun untuk satu orang. Jangan membagikan akun kepada orang lain.",
            "Satu ujian hanya dapat dibuka di satu perangkat pada satu waktu.",
            "Segera beri tahu kami bila Anda menduga akun dipakai orang lain.",
          ]}
        />
        <p>
          Siswa yang terdaftar lewat sekolah dikelola bersama sekolahnya. Sekolah dapat menghapus siswa dari daftar
          atau menandainya sebagai alumni, dan akses yang diberikan sekolah berakhir mengikuti masa kerja sama sekolah.
        </p>
      </Bagian>

      <Bagian nomor={3} judul="Penggunaan yang diperbolehkan">
        <p>Anda setuju untuk tidak:</p>
        <Daftar
          items={[
            "berlaku curang, misalnya meminta orang lain mengerjakan ujian atau memakai alat bantu terlarang saat ujian sekolah;",
            "menyalin, menyebarkan, atau menjual soal, kunci, dan pembahasan secara massal tanpa izin tertulis;",
            "memakai program otomatis (bot) atau mencoba menembus, membebani, atau mengganggu sistem;",
            "mengakses data milik orang lain atau menyalahgunakan hak akses yang Anda terima;",
            "menyebarkan konten yang melanggar hukum atau merugikan pihak lain.",
          ]}
        />
        <p>
          Kami dapat membatasi atau menonaktifkan akun yang melanggar aturan ini, dengan pemberitahuan bila
          memungkinkan.
        </p>
      </Bagian>

      <Bagian nomor={4} judul="Paket, pembayaran, dan voucher">
        <Daftar
          items={[
            "Setiap siswa mendapat percobaan gratis yang terbatas. Jumlah dan batasnya ditampilkan di aplikasi.",
            "Paket berbayar (bulanan atau semester), saldo untuk Learning Analytics tambahan, dan voucher mitra memberi akses sesuai yang tertulis saat pembelian. Harga yang berlaku adalah yang tampil di situs saat Anda membeli.",
            "Pembayaran dilakukan lewat mitra pembayaran pihak ketiga. Akses paket dapat aktif setelah pembayaran diverifikasi, dan bisa memerlukan waktu bila verifikasi dilakukan manual.",
            "Sekolah yang bekerja sama memperoleh akses bagi siswanya sesuai kesepakatan tertulis dengan sekolah, termasuk jumlah kursi dan masa berlakunya.",
            "Pengembalian dana ditangani kasus per kasus. Hubungi kami dengan bukti pembayaran.",
          ]}
        />
      </Bagian>

      <Bagian nomor={5} judul="Learning Analytics berbasis AI">
        <p>
          Analisis belajar dibuat otomatis oleh kecerdasan buatan dari hasil ujian Anda. Hasilnya berupa saran belajar
          dan dapat keliru, sehingga bukan penilaian resmi dan tidak menggantikan penilaian guru. Data yang dikirim
          ke penyedia AI dijelaskan di{" "}
          <Link className="text-indigo-700 underline underline-offset-2" href="/kebijakan-privasi">
            Kebijakan Privasi
          </Link>
          .
        </p>
      </Bagian>

      <Bagian nomor={6} judul="Hak atas konten">
        <p>
          Soal, kunci jawaban, pembahasan, kisi-kisi, tampilan, dan merek AyoTKA dimiliki oleh pengelola atau pemberi
          lisensinya. Anda boleh memakainya untuk belajar secara pribadi. Penggunaan di luar itu memerlukan izin
          tertulis dari kami.
        </p>
      </Bagian>

      <Bagian nomor={7} judul="Ketersediaan layanan">
        <p>
          Kami berusaha menjaga layanan tetap berjalan, tetapi tidak menjamin layanan bebas gangguan. Layanan dapat
          berhenti sementara untuk pemeliharaan atau karena gangguan di luar kendali kami, termasuk gangguan
          jaringan atau penyedia layanan pihak ketiga. Untuk ujian penting, sekolah disarankan menyiapkan rencana
          cadangan.
        </p>
      </Bagian>

      <Bagian nomor={8} judul="Batas tanggung jawab">
        <p>
          Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak langsung yang timbul dari pemakaian
          atau ketidakmampuan memakai layanan, termasuk perbedaan antara skor latihan dan hasil TKA yang sebenarnya.
          Ketentuan ini tidak menghapus hak Anda yang dijamin undang-undang.
        </p>
      </Bagian>

      <Bagian nomor={9} judul="Hukum yang berlaku">
        <p>
          Syarat ini tunduk pada hukum Republik Indonesia. Perselisihan kami upayakan selesai secara musyawarah
          terlebih dulu.
        </p>
      </Bagian>

      <Bagian nomor={10} judul="Perubahan dan kontak">
        <p>
          Syarat ini dapat berubah. Tanggal pembaruan terakhir tertera di bagian atas halaman, dan pemakaian layanan
          setelah perubahan berarti Anda menyetujuinya. Pertanyaan dapat disampaikan ke:
        </p>
        <BlokKontak />
      </Bagian>
    </HalamanHukum>
  );
}
