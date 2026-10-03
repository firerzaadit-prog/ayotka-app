import type { Metadata } from "next";
import Link from "next/link";
import { Bagian, BlokKontak, Daftar, HalamanHukum } from "@/components/public/halaman-hukum";

export const metadata: Metadata = {
  title: "Kebijakan Privasi - AyoTKA",
  description:
    "Data apa saja yang dikumpulkan AyoTKA, untuk apa dipakai, siapa yang dapat melihatnya, dan bagaimana orang tua, siswa, dan sekolah dapat meminta perubahan atau penghapusan data.",
};

/**
 * Isi disusun dari perilaku sistem yang sebenarnya (data yang disimpan, pihak ketiga yang dipakai, siapa yang dapat
 * melihat apa). Kalau perilaku itu berubah (mis. penyedia email, pengiriman data ke AI), halaman ini ikut diperbarui.
 */
export default function KebijakanPrivasiPage() {
  return (
    <HalamanHukum
      judul="Kebijakan Privasi"
      pembuka="AyoTKA melayani siswa SD dan SMP, jadi kami menjaga data dengan hati-hati. Halaman ini menjelaskan data apa yang kami simpan, untuk apa, dan siapa yang dapat melihatnya."
      diperbarui="3 Oktober 2026"
    >
      <Bagian nomor={1} judul="Siapa yang mengelola AyoTKA">
        <p>
          AyoTKA (ayotka.id) dikelola oleh Mathematics Learning Media And Technology Research Group (Maletech-RG),
          Departemen Matematika FMIPA UM. Dalam kebijakan ini, “kami” berarti pengelola tersebut. Cara
          menghubungi kami ada di bagian akhir halaman.
        </p>
      </Bagian>

      <Bagian nomor={2} judul="Data yang kami kumpulkan">
        <Daftar
          items={[
            <>
              <strong>Data akun:</strong> nama, alamat surel (atau NISN bagi siswa yang mendaftar tanpa surel), dan kata
              sandi. Kata sandi disimpan dalam bentuk sandi satu arah oleh penyedia autentikasi kami, sehingga kami
              tidak dapat membacanya.
            </>,
            <>
              <strong>Data siswa:</strong> NISN, tanggal lahir, jenjang (SD/SMP), dan sekolah. Untuk siswa yang
              terdaftar lewat sekolah, data ini diberikan oleh sekolah. Untuk pendaftaran mandiri, data ini diisi
              sendiri oleh siswa atau orang tuanya.
            </>,
            <>
              <strong>Aktivitas belajar:</strong> jawaban, skor, waktu pengerjaan, capaian per kompetensi, dan berapa
              kali siswa berpindah tab atau aplikasi saat ujian berlangsung.
            </>,
            <>
              <strong>Data teknis:</strong> alamat IP serta jenis perangkat dan peramban saat masuk dan saat
              mengerjakan ujian, untuk keamanan akun dan pencegahan penyalahgunaan. Tindakan penting oleh admin juga
              dicatat dalam log audit.
            </>,
            <>
              <strong>Data langganan:</strong> paket yang dipakai, saldo, voucher, dan kode rujukan. Mitra
              menambahkan nama dan kontak. Pembayaran dilakukan lewat pihak ketiga, dan kami tidak menyimpan nomor kartu
              atau rekening pembayar.
            </>,
          ]}
        />
      </Bagian>

      <Bagian nomor={3} judul="Untuk apa data dipakai">
        <Daftar
          items={[
            "Menyediakan latihan TKA, menghitung skor, dan menampilkan hasil serta pembahasan.",
            "Menyusun laporan kemajuan belajar untuk siswa, guru, dan sekolah.",
            "Membuat Learning Analytics (analisis belajar) dengan bantuan kecerdasan buatan (lihat bagian 5).",
            "Mengelola akun, langganan, dan dukungan pelanggan.",
            "Mengirim surel layanan: konfirmasi pendaftaran, atur ulang kata sandi, dan pengingat masa langganan sekolah.",
            "Menjaga keamanan, mencegah kecurangan, dan menyelidiki penyalahgunaan.",
            "Memahami pemakaian layanan secara gabungan agar dapat diperbaiki.",
          ]}
        />
        <p>Kami tidak menjual data pribadi dan tidak memakainya untuk iklan.</p>
      </Bagian>

      <Bagian nomor={4} judul="Siapa yang dapat melihat data">
        <Daftar
          items={[
            "Siswa melihat data dan hasilnya sendiri.",
            "Admin Sekolah melihat siswa di sekolahnya sendiri, termasuk nama, NISN, dan hasil ujian.",
            "Dinas Pendidikan memiliki akses hanya-baca untuk sekolah di wilayahnya, berupa statistik dan daftar capaian siswa.",
            "Mitra (reseller voucher) tidak dapat melihat identitas siswa. Mitra hanya melihat voucher dan komisi miliknya.",
            "Pengelola AyoTKA mengakses data seperlunya untuk operasional, dukungan, dan keamanan.",
          ]}
        />
      </Bagian>

      <Bagian nomor={5} judul="Pihak ketiga yang membantu kami">
        <p>Kami memakai penyedia layanan berikut untuk menjalankan AyoTKA. Mereka memproses data atas nama kami:</p>
        <Daftar
          items={[
            <>
              <strong>Supabase</strong> untuk basis data dan autentikasi, dan <strong>Vercel</strong> untuk menjalankan
              aplikasi. Server yang kami pilih berada di Singapura.
            </>,
            <>
              <strong>Google (Gemini API)</strong> untuk Learning Analytics. Saat analisis dibuat, dikirim nama siswa,
              nama paket, skor, capaian per kompetensi, serta soal dan jawaban siswa beserta kunci dan pembahasannya.
              Kami tidak mengirim NISN, tanggal lahir, surel, atau nama sekolah.
            </>,
            <>
              <strong>Penyedia pengiriman surel</strong> (Resend, Mailketing, atau layanan SMTP) untuk surel layanan.
              Yang mereka terima hanya alamat surel penerima, nama, dan isi surel.
            </>,
            <>
              <strong>Mitra pembayaran</strong> untuk transaksi paket berbayar. Pembayaran terjadi di situs mereka dan
              tunduk pada kebijakan privasi mereka.
            </>,
          ]}
        />
        <p>
          Karena sebagian penyedia berada di luar Indonesia, data dapat diproses di luar negeri. Kami memilih penyedia
          yang menerapkan pengamanan yang wajar.
        </p>
      </Bagian>

      <Bagian nomor={6} judul="Keamanan dan lama penyimpanan">
        <Daftar
          items={[
            "Seluruh akses melewati sambungan terenkripsi (HTTPS).",
            "Akses dibatasi menurut peran: siswa, admin sekolah, dinas, mitra, dan pengelola hanya melihat bagian yang menjadi haknya.",
            "Percobaan masuk yang gagal berulang dibatasi, dan sesi ujian hanya boleh aktif di satu perangkat.",
            "Kunci rahasia layanan disimpan terenkripsi.",
          ]}
        />
        <p>
          Kami menyimpan data selama akun aktif atau selama dibutuhkan untuk menyediakan layanan dan memenuhi kewajiban
          kami, kecuali hukum mengharuskan lebih lama. Tidak ada sistem yang sepenuhnya kebal, jadi bila Anda menduga
          akun disalahgunakan, segera hubungi kami.
        </p>
      </Bagian>

      <Bagian nomor={7} judul="Anak di bawah umur">
        <p>
          AyoTKA ditujukan untuk siswa SD dan SMP. Untuk siswa yang mendaftar lewat sekolah, sekolah bertanggung jawab
          memperoleh persetujuan orang tua atau wali sebelum menyerahkan data siswa kepada kami, sebagaimana diatur
          dalam kerja sama dengan sekolah. Untuk pendaftaran mandiri, kami meminta siswa didampingi orang tua atau
          wali.
        </p>
      </Bagian>

      <Bagian nomor={8} judul="Hak Anda atas data">
        <p>
          Anda, atau orang tua/wali bagi siswa, dapat meminta kami untuk menunjukkan data yang kami simpan, memperbaiki
          data yang keliru, menghapus data, atau menghentikan penggunaannya. Siswa yang terdaftar lewat sekolah
          sebaiknya mengajukan permintaan melalui sekolahnya, atau langsung ke kami. Kami akan menanggapi dalam waktu
          yang wajar dan dapat meminta bukti identitas lebih dulu untuk melindungi data tersebut.
        </p>
      </Bagian>

      <Bagian nomor={9} judul="Cookie dan penyimpanan di perangkat">
        <Daftar
          items={[
            "Cookie sesi masuk, agar Anda tetap masuk dan akses diperiksa sesuai peran.",
            "Cadangan jawaban sementara di peramban (IndexedDB) saat ujian, supaya jawaban tidak hilang bila koneksi putus.",
            "Cookie teknis untuk pengelola (mode kelola sekolah dan akses saat pemeliharaan).",
          ]}
        />
        <p>Kami tidak memasang cookie iklan atau pelacak pihak ketiga.</p>
      </Bagian>

      <Bagian nomor={10} judul="Perubahan kebijakan">
        <p>
          Kebijakan ini dapat diperbarui. Tanggal pembaruan terakhir tertera di bagian atas halaman. Perubahan
          penting akan kami sampaikan lewat situs atau surel. Ketentuan penggunaan layanan ada di halaman{" "}
          <Link className="text-indigo-700 underline underline-offset-2" href="/syarat-ketentuan">
            Syarat &amp; Ketentuan
          </Link>
          .
        </p>
      </Bagian>

      <Bagian nomor={11} judul="Hubungi kami">
        <p>Pertanyaan, permintaan terkait data, atau laporan masalah privasi dapat disampaikan ke:</p>
        <BlokKontak />
      </Bagian>
    </HalamanHukum>
  );
}
