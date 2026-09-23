const LANGKAH = [
  {
    judul: "Unduh template kosong",
    detail: "Klik tombol \"Unduh template kosong\" di bawah. File berisi 3 baris contoh (satu untuk tiap format soal) dan sheet \"Referensi Kompetensi\" khusus mapel paket ini.",
  },
  {
    judul: "Isi soal di sheet \"Soal\", mulai baris 2",
    detail: "Satu baris = satu soal. Baris contoh (kolom No berisi \"CONTOH\") boleh dihapus atau ditimpa — baris itu otomatis dilewati saat diimpor.",
  },
  {
    judul: "Pakai dropdown untuk kolom yang sudah disediakan",
    detail: "Klik sel pada kolom Format, Kode Kompetensi, Tingkat Kesulitan, Level Kognitif, atau Jawaban 1-3, lalu klik panah kecil di sisi kanan sel untuk memilih dari daftar — tidak perlu mengetik manual.",
  },
  {
    judul: "Sisipkan gambar kalau perlu (opsional)",
    detail: "Tempel langsung ke sel Excel, atau tulis link di kolom Media Soal / di dalam teks. Lihat detail 3 caranya di bagian \"Cara menyisipkan gambar\" di bawah.",
  },
  {
    judul: "Simpan file, lalu unggah",
    detail: "Pilih file yang sudah diisi lewat form di bawah, lalu klik \"Impor ke paket ini\".",
  },
  {
    judul: "Perbaiki kalau ada error",
    detail: "Kalau ada baris yang salah, semua kesalahan ditampilkan sekaligus (nomor baris + kolom) dan TIDAK ADA soal yang tersimpan. Perbaiki di file yang sama lalu unggah ulang — soal yang sudah pernah masuk tidak akan dobel.",
  },
];

const FORMAT_SOAL = [
  { kode: "pg", nama: "Pilihan Ganda", detail: "4-5 opsi, TEPAT 1 jawaban benar. Kolom Kunci Jawaban diisi satu huruf, mis. B." },
  { kode: "pg_kompleks", nama: "Pilihan Ganda Kompleks", detail: "2-8 opsi, boleh lebih dari 1 jawaban benar. Kolom Kunci Jawaban diisi huruf dipisah koma, mis. A,C." },
  { kode: "pg_kategori", nama: "Pilihan Ganda Kategori (Benar/Salah)", detail: "1-3 pernyataan. Isi kolom Pernyataan 1-3 dan Jawaban 1-3 (pilih Benar atau Salah dari dropdown). Kolom Opsi dan Kunci Jawaban dikosongkan." },
];

const CARA_GAMBAR = [
  {
    judul: "Tempel langsung di Excel",
    detail: "Insert > Pictures > pilih file (atau copy-paste gambar), lalu geser supaya pojok kiri-atas gambar ada di sel tujuan. Bisa di kolom Teks Soal, Pembahasan, Media Soal, Opsi A-H, atau Pernyataan 1-3. Jangan pakai \"Place in Cell\" — tidak terbaca sistem, harus \"Place Over Cells\".",
  },
  {
    judul: "Link Google Drive",
    detail: "Tempel link \"Bagikan\" biasa di kolom Media Soal, atau tulis ![](link-drive) di dalam teks. Akses file harus diset \"Siapa saja yang memiliki link\". Gambar akan diunduh dan disimpan otomatis ke sistem.",
  },
  {
    judul: "Link gambar lain (https://...)",
    detail: "Sama seperti Google Drive, tapi gambarnya tetap di alamat aslinya (tidak disalin ke sistem).",
  },
];

export function ExcelTutorial() {
  return (
    <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Cara mengisi &amp; mengimpor soal lewat Excel</h3>
      <ol className="mt-3 flex flex-col gap-2.5">
        {LANGKAH.map((l, i) => (
          <li key={l.judul} className="flex gap-2.5 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {i + 1}
            </span>
            <span>
              <span className="font-medium text-slate-800">{l.judul}.</span>{" "}
              <span className="text-slate-600">{l.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-col gap-2 border-t border-indigo-100 pt-3">
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-indigo-700 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
            Apa bedanya 3 format soal?
          </summary>
          <div className="mt-2 ml-4 flex flex-col gap-2">
            {FORMAT_SOAL.map((f) => (
              <p key={f.kode} className="text-xs text-slate-600">
                <code className="rounded bg-white px-1 py-0.5 font-mono text-indigo-700">{f.kode}</code>{" "}
                <span className="font-medium text-slate-800">({f.nama}):</span> {f.detail}
              </p>
            ))}
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-indigo-700 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
            Cara menyisipkan gambar (3 pilihan, boleh dicampur)
          </summary>
          <div className="mt-2 ml-4 flex flex-col gap-2">
            {CARA_GAMBAR.map((c, i) => (
              <p key={c.judul} className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">{i + 1}. {c.judul}:</span> {c.detail}
              </p>
            ))}
            <p className="text-xs text-slate-600">
              Posisi gambar di tengah teks: tulis <code className="rounded bg-white px-1 py-0.5">[gambar]</code> di
              tempat gambar harus muncul. Kalau ada 2 gambar dalam satu sel, tulis{" "}
              <code className="rounded bg-white px-1 py-0.5">[gambar 1]</code> dan{" "}
              <code className="rounded bg-white px-1 py-0.5">[gambar 2]</code>. Gambar tanpa penanda dilekatkan di
              akhir teks. Format PNG/JPEG/WEBP/GIF, maks 5 MB per gambar. Media Soal hanya boleh 1 gambar.
            </p>
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-indigo-700 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
            Kolom wajib &amp; aturan lain
          </summary>
          <div className="mt-2 ml-4 flex flex-col gap-1.5 text-xs text-slate-600">
            <p>
              <span className="font-medium text-slate-800">Kolom wajib:</span> Format, Teks Soal, Kode Kompetensi,
              Tingkat Kesulitan (mudah/sedang/sulit), Level Kognitif (L1/L2/L3).
            </p>
            <p>
              <span className="font-medium text-slate-800">Kode Kompetensi:</span> pilih dari dropdown atau lihat
              sheet &quot;Referensi Kompetensi&quot; di template (kode harus persis sama).
            </p>
            <p>
              <span className="font-medium text-slate-800">Bobot:</span> bilangan bulat minimal 1, boleh dikosongkan
              (default 1).
            </p>
            <p>
              <span className="font-medium text-slate-800">Rumus matematika:</span> tulis dengan LaTeX di antara
              tanda dolar, mis. <code className="rounded bg-white px-1 py-0.5">$x^2 + 3x = 10$</code>. Baris baru di
              dalam sel boleh pakai Alt+Enter.
            </p>
            <p>
              <span className="font-medium text-slate-800">Opsi jawaban:</span> diisi berurutan dari Opsi A tanpa
              celah (tidak boleh Opsi B kosong tapi Opsi C terisi).
            </p>
            <p>
              Soal yang teksnya sama persis dengan soal yang sudah ada di paket otomatis dilewati (aman untuk
              impor ulang, tidak jadi dobel). Soal baru ditambahkan; soal lama tidak diubah atau dihapus — untuk
              mengubah soal lama, edit lewat halaman soal. Maksimal 300 soal per file.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
