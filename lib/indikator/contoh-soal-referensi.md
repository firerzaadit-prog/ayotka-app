# Contoh Soal Resmi TKA — Referensi untuk Kalibrasi Generator soal.ayotka.id

> Dikumpulkan 27 September 2026, dua kategori sumber:
> 1. **Sumber resmi** — situs Pusmendik Kemendikdasmen, menu "Contoh Soal" per mata pelajaran/jenjang. Ini ground truth utama.
> 2. **Sumber pihak ketiga (bimbel)** — Brain Academy dan Ruangguru, contoh soal buatan mereka sendiri bergaya TKA (BUKAN soal resmi Kemendikdasmen, tapi berguna sebagai referensi variasi gaya tambahan).
>
> Tujuan dokumen ini: bahan pembanding kualitatif saat mengevaluasi hasil generate AI soal.ayotka.id — bukan untuk disalin sebagai bank soal (soal resmi ini publik dan siswa/guru mungkin sudah mengenalnya).

---

## RINGKASAN POLA PENTING UNTUK KALIBRASI GENERATOR

1. **Gaya bahasa natural, nama tokoh sangat variatif** (Ani, Mae, Pak Bakri, Pak Bondan, Dio, Nisa, Dinda, Sarah, dll.) — konsisten dengan larangan klise "Budi/Siti" yang sudah kita terapkan.
2. **Soal Matematika hampir selalu naratif kontekstual multi-langkah** — jarang hitungan telanjang. Skenario dunia nyata: proyek renovasi gedung, donor darah PMI, promo toko, jasa antar barang, dll.
3. **Pola stimulus grup jelas terlihat** — satu skenario dipakai berurutan untuk 2-3 nomor sekaligus (mis. "Proyek Renovasi Gedung" untuk No. 6-8 SMP, "Alur Pelayanan Donor Darah PMI" untuk No. 9-11 SMP, "Pelari Terakhir" untuk beberapa nomor Bahasa Indonesia SMP).
4. **Pola dua-teks-antarteks sudah muncul di soal resmi SMP** (No. 1-3: "Teks Ulasan 1" vs "Teks Ulasan 2" tentang wisata pantai, dibandingkan langsung) — ini memvalidasi instruksi STIMULUS GANDA ANTARTEKS yang sudah ada di prompt generator kita.
5. **Sumber teks Bahasa Indonesia selalu dicantumkan eksplisit** (URL artikel + "dengan penyesuaian") — umumnya dari situs berita/pengetahuan populer: kumparan.com, bobo.grid.id, tirto.id, historia.id, katadata.co.id, indonesiabaik.id, banjar.times.co.id. Bukan teks fiktif murni tanpa rujukan.
6. **Label PGK Kategori TIDAK selalu "Benar/Salah"** — kadang "Sesuai/Tidak Sesuai" (evaluasi relevansi), "Setuju/Tidak Setuju" (menanggapi pendapat), atau "Mendukung/Tidak Mendukung" (menilai argumen) — tergantung jenis pertanyaan. Perlu dicek apakah field kategori_respons generator kita sudah cukup fleksibel menangani label selain Benar/Salah.
7. **Istilah teknis/asing selalu diberi glosarium terpisah** ("Daftar Istilah" untuk hidden gem, bucket list, golden hour, vibes, estetis) — konsisten dengan aturan maksimal istilah + gloss yang sudah diterapkan di prompt Bahasa Indonesia kita.
8. **Data untuk diagram/piktogram TIDAK diberi angka lengkap di teks** — nilainya hanya ada di gambar (Data Pengunjung Perpustakaan, Piktogram Buku Dibaca) — mengonfirmasi diagram data memang harus presisi dan terbaca ulang, relevan dengan bug Nano Banana yang baru diperbaiki (diagram data tidak boleh jadi ilustrasi dekoratif).
9. **Label kompetensi Bahasa Indonesia — KOREKSI (dievaluasi ulang 30 September 2026)**: Perkaban BSKAP No. 47/2025 hanya mendefinisikan TIGA kompetensi resmi untuk Bahasa Indonesia SD maupun SMP: Pemahaman Tekstual, Pemahaman Inferensial, serta Evaluasi dan Apresiasi. Label bergaya PISA ("Mengakses dan Menemukan Informasi / Menginterpretasi dan Mengintegrasi / Mengevaluasi dan Merefleksi") yang terlihat pada sebagian contoh di situs Pusmendik hanya variasi pelabelan dengan isi yang hampir satu-satu sepadan, BUKAN taksonomi tambahan yang wajib ditiru. Catatan sebelumnya di dokumen ini yang menyarankan generator mengakomodasi dua taksonomi dinyatakan tidak berlaku; generator yang memakai tiga label Perkaban sudah patuh kebijakan.

10. **Sebaran konteks soal Matematika (hitungan perkiraan dari transkripsi ringkas di dokumen ini, bukan hitungan formal)**: Perkaban 47/2025 membedakan dua jenis konteks — "konteks matematika" dan "konteks keseharian" (situasi personal, keluarga, atau lingkungan sekitar; untuk SMP bersifat lokal). Pada 30 contoh soal SD resmi, kira-kira 40%+ berkonteks personal/keluarga/dunia anak (ulang tahun, belanja bersama Ibu, membantu Ayah, les menari, hobi membaca, kebutuhan gizi anak), dan hanya sekitar 15% berkonteks pekerjaan orang dewasa. Pada 30 contoh soal SMP resmi, kira-kira 20% adalah soal konteks matematika tanpa narasi (faktor persekutuan, bentuk aljabar, SPL dari solusi diketahui, pola titik, kesebangunan, transformasi) yang tetap menuntut penalaran. Soal yang menuntut siswa menyusun model sendiri (Formulate) di SMP resmi juga hanya sekitar 20%.

---

## SUMBER RESMI 1 — MATEMATIKA SD/MI Sederajat (30 soal)

Sumber: https://pusmendik.kemendikdasmen.go.id/tka/tka/view/mata-pelajaran-wajib/sd

No 1 — Kompetensi: operasi penjumlahan/pengurangan/perkalian/pembagian bilangan pecahan | PG | Kunci: A

No 2 — Kompetensi: sama | PG | Kunci: C
"Menjelang tahun ajaran baru, Toko Buku Ceria memberikan diskon 10% untuk semua jenis buku. Diketahui harga buku gambar adalah [x] dari harga buku komik. Harga buku tulis adalah 0,75 kali harga buku komik. Diketahui harga buku komik adalah Rp24.000,00. Harga buku gambar dan buku tulis setelah dikenakan diskon adalah ...." Pilihan: Rp18.000 / Rp24.000 / Rp27.000 / Rp30.000

No 3 — Kompetensi: operasi pecahan dengan bilangan asli | PGK Kategori | Kunci: Benar-Benar-Salah
"Pak Bondan seorang penjual susu kedelai. Suatu hari, Pak Bondan memproduksi susu kedelai sebanyak 7 wadah yang masing-masing berisi [x] liter susu kedelai. Seluruh hasil produksi tersebut akan dituangkan ke dalam 50 botol besar dengan isi yang sama banyak dan ke dalam 15 botol kecil dengan isi setiap botolnya adalah setengah botol besar." (3 pernyataan Benar/Salah tentang total produksi, isi per botol besar, total di botol kecil)

No 4 — Kompetensi: konstruksi bangun ruang & visualisasi spasial | PG | Kunci: B
"Mae bermain ular tangga menggunakan sebuah dadu. Diketahui bahwa jumlah titik pada setiap dua sisi berlawanan pada dadu adalah sama... Pada dadu tersebut, banyak titik yang ada di sisi bawah adalah ...." Pilihan: 2/3/4/5

No 5 — Kompetensi: hubungan antar-satuan baku berat | PGK MCMA | Kunci: Pernyataan 1 dan 3
"Setiap bulan Ramadan, SD Harapan mengadakan bakti sosial. Mereka membagi sembako yang berisi 3 kg beras, dua bungkus gula pasir dengan berat masing-masing kemasan 5 hg, dan lima bungkus mi instan dengan berat per bungkus 85 g." Pernyataan: total berat 4.425 gram / berat mi instan >0,5 kg / satu kemasan gula lebih berat dari seluruh mi instan

No 6 — Kompetensi: pengambilan informasi & penggunaan data | PGK Kategori | Kunci: Benar-Salah-Benar
"SD Harapan baru saja meresmikan ruang perpustakaan untuk siswa. Bu Anita sedang mendata banyak siswa yang berkunjung ke perpustakaan tersebut pada lima hari pertama sejak diresmikan." (diagram data pengunjung; 3 pernyataan Benar/Salah)

No 7 — Kompetensi: penyajian data (piktogram, diagram batang, tabel frekuensi) | PGK Kategori | Kunci: Benar-Benar-Salah
"SD Mutiara mengadakan program pekan literasi... Rina, Dika, dan Siti mencatat buku yang mereka baca dalam bentuk piktogram" (3 pernyataan Benar/Salah tentang jumlah buku dibaca)

No 8 — Kompetensi: penaksiran ukuran | PG | Kunci: D
"Pak Bakri mempunyai lahan seluas 3,5 hektar. Pada lahan tersebut, [x] bagiannya akan ditanami cabai merah, [x] bagiannya akan ditanami tomat, dan sisanya akan ditanami daun bawang. Berapakah luas lahan yang akan ditanami tomat dan daun bawang?" Pilihan: 1,63 / 1,87 / 2,33 / 2,80 hektar

No 9 — Kompetensi: volume bangun ruang (kubus, balok) | PG | Kunci: B
"Sebuah bak berbentuk kubus memiliki volume sebesar [x]. Bak tersebut akan diubah menjadi sebuah balok dengan panjangnya 2 kali dari ukuran bak sebelumnya, lebarnya [x] dari ukuran bak sebelumnya, dan tingginya sama..." Pilihan: 4,5 / 9 / 18 / 22,5 m³

No 10 — Kompetensi: laju perubahan (kecepatan) | PG | Kunci: B
"Pak Bayu dan keluarganya tinggal di Kota Yogyakarta dan berencana untuk liburan ke Semarang. Diketahui jarak Yogyakarta-Semarang 140 km dan kecepatan rata-rata mobil Pak Bayu 80 km/jam. Pak Bayu dan keluarga berangkat dari rumah pukul 06.00. Apabila di tengah perjalanan mereka berhenti selama 15 menit untuk membeli oleh-oleh, pukul berapakah Pak Bayu dan keluarga tiba di Semarang?" Pilihan: 07.45/08.00/08.45/09.00

No 11 — Kompetensi: waktu | PGK Kategori | Kunci: Benar-Benar-Salah
"Lala berulang tahun setiap tanggal 14 Juni. Dia akan berusia 13 tahun pada bulan Juni tahun ini. Sekarang tanggal 30 April." (3 pernyataan tentang hitungan hari/minggu/bulan menunggu)

No 12 — Kompetensi: berat benda satuan baku | PG | Kunci: B
"Ibu pergi ke pasar membeli 3 kg buah. Di dalam keranjang belanja ibu, terdapat dua buah alpukat mentega dengan berat 1,25 kg dan sisanya adalah tujuh buah mangga kweni. Berat satu buah mangga kweni adalah ...." Pilihan: 0,2/0,25/0,3/0,35 kg

No 13 — Kompetensi: hubungan antar-satuan baku volume | PGK Kategori | Kunci: Benar-Salah-Benar
"Seorang petani memiliki tangki berisi air sebanyak 0,8 hektoliter... akan ditampung ke dalam bak penampungan... Bak penampungan dapat menampung 20 liter air." (3 pernyataan)

No 14 — Kompetensi: volume benda satuan baku | PGK MCMA | Kunci: Pernyataan 1 dan 2
"Bu Guru menugaskan Doni untuk membawa sebuah kotak yang dapat menampung 64 kubus satuan (rusuk 1 cm)." Pilihan kotak: 8×2×4 cm / 4×4×4 cm / 4×3×5 cm

No 15 — Kompetensi: hubungan antar-satuan baku panjang | PGK Kategori | Kunci: Salah-Benar-Benar
"Nisa sedang mengunjungi kebun binatang. Dia ingin melihat Capybara..." (papan petunjuk jarak; 3 pernyataan)

No 16 — Kompetensi: panjang benda satuan baku | PG | Kunci: B
"Dio sedang membantu ayah memotong batang rotan untuk dijadikan stik pewangi ruangan. Ayah mempunyai batang rotan dengan panjang 320 cm. Ayah ingin membuat stik pewangi ruangan sebanyak mungkin dengan panjang stik masing-masing 15 cm. Sisa batang rotan yang tidak terpakai adalah ...." Pilihan: 4/5/6/7 cm

No 17 — Kompetensi: kelipatan, faktor, KPK, FPB | PG | Kunci: C
"Murid-murid SD Cerdas, SD Pelita, dan SD Mentari melakukan kegiatan olahraga... setiap 2/3/4 minggu sekali. Hari ini ketiga SD tersebut melakukan kegiatan olahraga secara bersamaan. Setiap periode waktu berapakah murid ketiga SD tersebut akan bertemu lagi?" Pilihan: 4/6/12/18 minggu

No 18 — Kompetensi: operasi pecahan | PG | Kunci: A
No 19 — Kompetensi: perbandingan & pengurutan bilangan pecahan | PG | Kunci: B
"Desti mendapatkan hadiah satu loyang kue... memotong kuenya menjadi beberapa bagian... Berapa bagiankah kue yang berwarna cokelat dari keseluruhan kue?"

No 20 — Kompetensi: keliling & luas bangun datar | PG | Kunci: B
"Pak Boni memiliki sebidang tanah berbentuk bangun [gambar]. Berapakah keliling bidang tanah Pak Boni?" Pilihan: 58/68/72/96 m

No 21 — Kompetensi: operasi bilangan cacah | PG | Kunci: C
"Perpustakaan SD Cahaya mengadakan 'Ayo Membaca Buku'. Kelas A 28 siswa, Kelas B 36 siswa, Kelas C 32 siswa. Setiap siswa dapat 3 buku. Jika 1 dus berisi 24 buku, berapa dus dibutuhkan?" Pilihan: 8/10/12/24 dus

No 22 — Kompetensi: pecahan senilai dengan gambar/simbol | PG | Kunci: B
"Andi, Beni, Citra, Dika mengikuti 'Lari Sehat', target 10 km. Andi 0,4 bagian, Beni 60%, Citra [x] bagian, Dika 5,5 km. Siapa yang menempuh [x] bagian dari total jarak?"

No 23 — Kompetensi: sifat bangun datar | PG | Kunci: C
"Keempat sisinya sama panjang. Dua pasang sisi sejajar. Diagonal berpotongan tegak lurus. Sudut berhadapan sama besar. Nama bangun datar?" Pilihan: Persegi/Persegi panjang/Belah ketupat/Layang-layang

No 24 — Kompetensi: waktu | PG | Kunci: C
"Rani berangkat 07.25, perjalanan 45 menit, belajar menari 1 jam 35 menit, istirahat 20 menit. Pukul berapa Rani meninggalkan sanggar?" Pilihan: 09.45/10.00/10.05/10.25

No 25 — Kompetensi: satuan panjang/berat (termasuk pemilihan satuan tepat) | PG | Kunci: B
"TAMAN KOTA — desain denah taman kota, lebar jalan parkir mobil 2 meter, satu mobil baru keluar. Berapa mobil lagi yang dapat diparkir?"

No 26 — Kompetensi: keliling/luas persegi panjang | PGK Kategori | Kunci: Benar-Salah-Salah
"TAMAN KOTA — lahan parkir motor, satu motor perlu [x] m². Pukul 13.00 ada 12 motor, ternyata masih muat 1 motor lagi." (3 pernyataan)

No 27 — Kompetensi: bilangan pecahan ↔ desimal/persentase | PG | Kunci: D
"HOBI MEMBACA BUKU — Danu, Antok, Caca. Gambar bagian buku dibaca sampai hari Kamis minggu pertama. Berapa persen halaman yang sudah dibaca Caca?" Pilihan: 34/50/66/75%

No 28 — Kompetensi: operasi bilangan cacah/pecahan/desimal (termasuk estimasi) | PGK Kategori | Kunci: Benar-Benar-Salah
Konteks sama (HOBI MEMBACA BUKU) — 3 pernyataan jumlah halaman dibaca.

No 29 — Kompetensi: penyajian & interpretasi data (diagram batang/tabel) | PGK MCMA | Kunci: Pernyataan 1 dan 3
"LEMAK SEHAT UNTUK ANAK — anak 10-12 tahun butuh protein ≥55 gram/hari. Makanan 250 gram: daging sapi/telur ayam/ikan — mana yang cukupi kebutuhan?"

No 30 — Kompetensi: penyajian & interpretasi data | PGK Kategori | Kunci: Salah-Benar-Benar
Konteks sama (LEMAK SEHAT) — ibu hamil kebutuhan protein 70-100g, lemak 62-67g/hari — 3 pernyataan penambahan konsumsi.

---

## SUMBER RESMI 2 — MATEMATIKA SMP/MTs Sederajat (30 soal)

Sumber: https://pusmendik.kemendikdasmen.go.id/tka/tka/view/mata-pelajaran-wajib/smp

No 1 — Sub: Bilangan Real | PG | Kunci: A
"Ani membeli 2 pulpen dan 2 pensil... Harga satuan pulpen Rp12.000, pensil Rp8.000. Promo 'Hemat Berempat': setiap pembelian 4 barang (boleh campur) dapat potongan harga sebesar harga 1 barang termurah. Total harga yang harus dibayar Ani?" Pilihan: Rp32.000/36.000/40.000/44.000

No 2 — Sub: Bilangan Real (estimasi) | PGK MCMA | Kunci: Pernyataan 1,2,3
"Toko menjual 1 kg beras Rp12.750. Jika beli 19,6 kg, perkiraan total harga?" Pernyataan: <Rp260rb / >Rp240rb / ≈20×12.500 / ≈Rp230rb

No 3 — Sub: Bilangan Real (faktorisasi prima) | PGK MCMA | Kunci: Pernyataan 3,4
"Tiga bilangan: (33²−3²), (8²+29⁶ [approx]), (3⁶×3⁵). Faktor persekutuan ketiganya?" Pilihan berbentuk perkalian faktor prima berpangkat.

No 4 — Sub: Rasio (skala, proporsi, laju perubahan) | PG | Kunci: B
"Larutan desinfektan A:B = 3:5. Tersedia 2,5 liter cairan B, volume maksimum larutan yang dapat dibuat?" Pilihan: 3,6/4,0/4,8/6,4 liter

No 5 — Sub: perbandingan senilai/berbalik nilai | PG | Kunci: B
"Harga 0,5 kg cabe rawit Rp35.000. Beli [x] kg, total harga?" Pilihan: Rp175.000/157.500/140.000/87.500

No 6-8 — Stimulus GRUP "Proyek Renovasi Gedung" (kontrak 60 hari, produktivitas pegawai konstan):
- No 6 (PG, Kunci B): 12 pegawai selesai 60 hari → jadi 18 pegawai, berapa hari? Pilihan: 30/40/45/90 hari
- No 7 (PGK Kategori, Kunci Benar-Benar-Salah): skenario 15 pegawai, 10 hari pertama hanya 10 pegawai bekerja, lalu 15 kembali — 3 pernyataan tentang sisa pekerjaan/keterlambatan/solusi
- No 8 (PGK MCMA, Kunci Pernyataan 1&3): skenario 20 pegawai, berhenti total 12 hari karena cuaca setelah 24 hari berjalan — 4 pernyataan tentang sisa waktu/beban kerja/kebutuhan pegawai

No 9-11 — Stimulus GRUP "Alur Pelayanan Donor Darah PMI" (proses: pemeriksaan kesehatan → antre → ambil darah → pemulihan, dengan durasi tiap tahap):
- No 9 (PG, Kunci C): pendonor baru datang, tidak ada antrian, apa yang dilakukan setelah 25 menit?
- No 10 (PGK MCMA, Kunci Pernyataan 1&4): Yuda, Rama, Fajar di posko bersamaan — pernyataan mana yang mungkin terjadi?
- No 11 (PGK Kategori, Kunci Benar-Salah-Benar): posko tambah 1 loket, situasi jam 11.30 — 3 pernyataan tentang jadwal kedatangan/ruang tunggu/tahap pemulihan

No 12 — Sub: Bentuk Aljabar (komutatif, asosiatif, distributif) | PG | Kunci: A
No 13 — Sub: Persamaan & Pertidaksamaan Linier | PGK MCMA | Kunci: Pernyataan 1,2,3
"Jasa antar barang: biaya tetap Rp12.000 + Rp4.000/km. Anggaran ≤Rp40.000. Model matematika & implikasinya?"

No 14 — Sub: SPLDV | PGK Kategori | Kunci: Benar-Benar-Salah
"SPL dengan solusi (x,y)=(5,-2), tentukan sifat a dan b (bilangan prima, ganjil, nilai 10a+b)"

No 15 — Sub: Fungsi (domain, kodomain, range) | PG | Kunci: B
"Pabrik memproduksi batang logam, fungsi f(n) menyatakan berat total untuk n batang. 7 batang → total berat?" Pilihan: 35/45/50/70 kg

No 16 — Sub: Barisan & Deret | PG | Kunci: C
"Pola susunan titik segitiga (1,3,6,10,...). Jumlah titik pada pola ke-6?" Pilihan: 15/18/21/28

No 17 — Sub: Barisan & Deret (aritmetika turun) | PGK Kategori | Kunci: Salah-Benar-Benar
"Potongan papan kayu: pertama 240 cm, tiap potongan berikutnya lebih pendek 12 cm, 9 potongan total." (3 pernyataan)

No 18 — Sub: Objek Geometri (sudut garis sejajar & transversal) | PGK Kategori | Kunci: Benar-Salah-Benar
"Desain jembatan, sketsa garis L1∥L2, L3∥L4, sudut A=50°" (3 pernyataan sudut D, C, B&E)

No 19 — Sub: Objek Geometri (kekongruenan & kesebangunan) | PGK Kategori | Kunci: Benar-Benar-Salah
"Segitiga ABD dan CAD sebangun?" (3 pernyataan panjang sisi BC, AC)

No 20 — Sub: Pengukuran (keliling & luas gabungan) | PGK Kategori | Kunci: Benar-Benar-Salah
"Taman kota persegi panjang, kolam lingkaran di tengah, π=22/7" (3 pernyataan luas selisih/penambahan diameter/luas rumput)

No 21 — Sub: Objek Geometri (keliling & luas) | PG | Kunci: C
"Pak Doni mengecat dinding samping rumah. 4 merek cat dengan daya sebar & kemasan berbeda (tabel). Cat mana yang sisa paling sedikit?"

No 22 — Sub: Objek Geometri (jaring-jaring bangun ruang) | PG | Kunci: B
"Kemasan prisma segitiga dari karton 50×100 cm. Banyak kemasan maksimum?" Pilihan: 4/8/9/14

No 23 — Sub: Transformasi Geometri (translasi) | PG | Kunci: C
"Robot pembersih, translasi T(4,-2), posisi setelah berpindah?"

No 24 — Sub: Transformasi Geometri (identifikasi transformasi tunggal) | PG | Kunci: C
"Transformasi tunggal paling tepat mengubah segitiga ABC → A'B'C'?" Pilihan: translasi/refleksi garis/rotasi 90°/refleksi sumbu-Y

No 25 — Sub: Pengukuran (volume prisma/limas/bola) | PG | Kunci: B
"Monumen dari bata ringan 60×20×10 cm, tersusun rapat tanpa celah. Jumlah minimal bata?" Pilihan: 16.800/18.000/19.200/21.600 buah

No 26 — Sub: Data | PG | Kunci: D
"Data peminjaman buku 5 hari (diagram batang). Pernyataan tepat?"

No 27 — Sub: Data | PGK MCMA | Kunci: Pernyataan 1&2
"Koperasi sekolah: data pengunjung 5 bulan + persentase alat tulis terjual (diagram garis+data%)."

No 28 — Sub: Data (mean, median, modus, jangkauan) | PG | Kunci: D
"Rata-rata berat telur kecil/sedang/besar. Kemasan 10 butir rata-rata 55 gram, sudah ada 1 besar+5 sedang+2 kecil, 2 tambahan yang harus dipilih?"

No 29 — Sub: Peluang | PG | Kunci: A
"Quality control lampu: 980 baik, 20 rusak. Peluang terpilih lampu rusak?"

No 30 — Sub: Peluang (frekuensi relatif) | PGK MCMA | Kunci: Pernyataan 1,2,3
"Sensor otomatis diuji 3 tahap (tabel hasil). Pernyataan benar tentang peluang kegagalan sensor?"

---

## SUMBER RESMI 3 — BAHASA INDONESIA SD/MI Sederajat (30 soal)

Sumber: https://pusmendik.kemendikdasmen.go.id/tka/tka/view/mata-pelajaran-wajib/sd/bahasa-indonesia

**Stimulus "Fabel hutan" (No 1-3):** Pemahaman Tekstual (PG, Kunci D) — siapa mengusulkan bantuan hewan cerdik; Pemahaman Inferensial (PG, Kunci B) — makna "diam seribu bahasa"; Evaluasi & Apresiasi (PGK Kategori, Kunci Tidak Sesuai-Sesuai-Sesuai) — relevansi dengan kehidupan sehari-hari.

**Stimulus "Hewan Pemakan Daun, Apa Itu?" (No 4-6, teks nonfiksi, sumber bobo.grid.id):** No 4 PGK MCMA Kunci B,C (contoh hewan folivora: sapi/koala/panda); No 5 PG Kunci D (bagan yang sesuai); No 6 PG Kunci C (gagasan utama paragraf ketiga: cara tubuh folivora mencerna daun).

**Stimulus "Kenthus yang Sombong" (No 7-9, fabel, sumber ceritaanak.org):** No 7 PGK MCMA Kunci Pernyataan 2&3 (apa yang dijelaskan Koko tentang anak lembu); No 8 PG Kunci C (kejadian yang membuat Kenthus menyesal); No 9 PGK Kategori Kunci Benar-Salah-Salah (reaksi emosional pembaca terhadap akhir cerita).

No 10 — Pemahaman Tekstual (kosakata umum/khusus) | PG | Kunci: D — makna kata "menegangkan"

No 11-12 — Stimulus surat Margaret Hamilton (kode komputer misi Apollo 11): No 11 PG Kunci C (pernyataan pendukung ide utama); No 12 PGK Kategori Kunci Benar-Salah-Benar (pelajaran hidup dari pengalaman tokoh).

No 13-15 — Stimulus DIY magnet kulkas (sumber idntimes.com): No 13 PG Kunci D (benda umum dalam kerajinan); No 14 PGK MCMA Kunci Pernyataan 1&3 (mengapa langkah kedua mendukung tujuan teks); No 15 PG Kunci B (mengapa mainan dibagi dua bagian).

No 16-18 — Stimulus infografis "Air Putih atau Air Mineral?" (sumber indonesiabaik.id): No 16 PG Kunci C (fungsi elektrolit); No 17 PG Kunci A (mengapa air putih cocok dikonsumsi setiap saat); No 18 PGK Kategori Kunci Benar-Benar-Salah (alasan warna oranye pada judul infografis — menilai kesesuaian ilustrasi dengan isi).

No 19-21 — Stimulus "Antre, Dong!" (cerita, konflik antrean toko buku): No 19 PG Kunci D (tokoh penyelesai keributan: Pak Satpam); No 20 PGK MCMA Kunci Pernyataan 1&3 (peristiwa yang dialami Tia); No 21 PGK Kategori Kunci Mendukung-Tidak Mendukung-Mendukung (alasan mendukung pendapat tokoh).

No 22-24 — Stimulus "Kenapa Kita Tidak Boleh Malas Menyikat Gigi?" (sumber bobo.grid.id): No 22 PG Kunci D (penyebab gigi berlubang); No 23 PGK MCMA Kunci Pernyataan 1&3 (akibat gigi tidak dirawat); No 24 PGK Kategori Kunci Salah-Benar-Salah (fungsi tanda panah pada gambar teks).

No 25-27 — Stimulus puisi "Surat untuk Sahabat" (sumber antologi puisi anak Kemendikdasmen): No 25 PGK MCMA Kunci Pernyataan 1&2 (larik yang menunjukkan kerinduan); No 26 PG Kunci D (makna "kesetiaan yang tak lekang oleh masa"); No 27 PG Kunci C (pesan puisi).

No 28-30 — Stimulus "Kerupuk Nusantara" (sumber tirto.id & historia.id): No 28 PG Kunci C (nama kerupuk sejak lama: Rambak); No 29 PGK Kategori Kunci Benar-Salah-Benar (mengapa kerupuk Indonesia mendunia); No 30 PGK Kategori Kunci Benar-Benar-Salah (mengapa ada gambar berbagai jenis kerupuk — menilai kesesuaian ilustrasi).

---

## SUMBER RESMI 4 — BAHASA INDONESIA SMP/MTs Sederajat (29 dari 30 soal berhasil diambil)

Sumber: https://pusmendik.kemendikdasmen.go.id/tka/tka/view/mata-pelajaran-wajib/smp/Bahasa-Indonesia

**Stimulus GANDA ANTARTEKS "Teks Ulasan 1 & 2" tentang wisata pantai (No 1-3, + glosarium istilah asing: hidden gem, bucket list, golden hour, vibes, estetis):** No 1 PG Kunci D (kosakata "harmoni alam"); No 2 PGK MCMA Kunci A,C (perbedaan informasi kedua teks); No 3 PGK Kategori Kunci Benar-Salah-Salah (menilai argumen pembaca yang membandingkan kedua teks).

No 4-5 — Stimulus puisi tentang perempuan pekerja pasar: No 4 PGK MCMA Kunci Pernyataan 2&4 (pilihan kata penunjuk latar waktu); No 5 PG Kunci A (makna "merebut hidup di pasar-pasar kota").

No 6 — PGK Kategori Kunci Setuju-Setuju-Tidak Setuju — menilai pendapat 3 murid tentang suasana haru puisi.

**Stimulus "Babirusa" (No 7-9, sumber kumparan.com):** No 7 PGK MCMA Kunci Pernyataan 1,2,4; No 8 PGK Kategori Kunci Salah-Benar-Benar; No 9 PGK MCMA Kunci Pernyataan 1,3,4 (dampak jika habitat terancam — memprediksi peristiwa).

**Stimulus GANDA "Kerajinan Kain Perca" (No 10-12, dua sumber digabung: liberty-society.com & kumparan.com):** No 10 PGK MCMA Kunci Pernyataan 2&3; No 11 PGK MCMA Kunci Pernyataan 1&3; No 12 PG Kunci B (memprediksi akibat jika busa tidak diletakkan di kain).

**Stimulus "Pelari Terakhir" (No 13-15, cerita terjemahan dari Chicken Soup for the Preteen Soul):** No 13 PG Kunci D; No 14 PGK Kategori Kunci Benar-Salah-Benar; No 15 PGK Kategori Kunci Salah-Benar-Benar (menilai fungsi gambar dalam cerita).

**Stimulus "Kehidupan Tradisional Desa Baduy" (No 16-18, laporan observasi, dua sumber digabung):** No 16 PG Kunci A (makna istilah "eksploitasi"); No 17 PG Kunci B (kerangka/bagan yang tepat); No 18 PGK MCMA Kunci Pernyataan 1,2,4 (hubungan antarparagraf).

**Stimulus "Bola Bekel Dinda" (No 19-21, cerita):** No 19 PG Kunci C; No 20 PGK MCMA Kunci Pernyataan 2&3 (sifat tokoh: suportif, percaya diri, dst.); No 21 PGK Kategori Kunci Benar-Benar-Salah (memprediksi akibat jika kejadian tidak terjadi).

**Stimulus "Pidato Pagi" tentang literasi informasi/hoaks (No 22-24):** No 22 PGK MCMA Kunci Pernyataan 1&2 (sasaran pidato); No 23 PGK Kategori Kunci Salah-Benar-Benar (pesan pidato); No 24 PG Kunci C (menilai judul yang lebih tepat mengganti judul umum).

**Stimulus "Peluang Karier di Sektor Hijau / Green Jobs" (No 25-27, teks informasi dengan data statistik ILO/IRENA):** No 25 PG Kunci C; No 26 PG Kunci B (mengapa urban farming cocok untuk milenial); No 27 PG Kunci A (menilai akurasi sumber informasi — kompetensi "Mengevaluasi dan Merefleksi").

**Stimulus "Kuliner Ayam Panggang Ponorogo" (No 28-29+, teks berita ekonomi lokal):** No 28 PG Kunci C (makna istilah "perekonomian"); No 29 PG Kunci D (hubungan antarparagraf, terpotong sebelum lengkap terekstrak).

---

## SUMBER PIHAK KETIGA (BUKAN RESMI) — Referensi Tambahan Gaya Bimbel

⚠️ Soal-soal berikut BUKAN dari Kemendikdasmen, melainkan buatan platform bimbingan belajar sendiri dengan gaya meniru TKA. Berguna sebagai referensi variasi tambahan, tapi jangan diperlakukan setara ground truth resmi di atas.

### Brain Academy — Contoh Soal TKA SMP
Sumber: https://www.brainacademy.id/blog/soal-tka-smp-matematika-bahasa-indonesia

Matematika: volume akuarium balok (50×30×40 cm); translasi titik koordinat A(3,-5) oleh T(2,7); statistika (mean/median/range usia 5 guru dengan syarat tertentu); peluang koin bias P(H)=2×P(T).

Bahasa Indonesia: identifikasi jenis energi terbarukan dalam teks; hubungan logis kondisi geografis & potensi energi; menilai relevansi dampak energi terbarukan dengan kehidupan sehari-hari.

### Ruangguru — Contoh Soal TKA SMP
Sumber: https://www.ruangguru.com/blog/simulasi-soal-tka-smp

Bahasa Indonesia: teks "Mikroplastik dalam Kehidupan Sehari-hari" (pemahaman tekstual multi-jawaban); teks "Surat untuk Ayah" (inferensial, hubungan kata penenang ibu dengan matanya yang berkaca-kaca); ulasan film "Laskar Pelangi" (evaluasi & apresiasi, menilai relevansi).

Matematika: bentuk eksponen (2a=3; 3b=4); perbandingan suhu tiga kota; SPLDV; pemodelan usia ayah-anak.

### Catatan sumber lain yang TIDAK berhasil diakses
- zenius.net — diblokir oleh robots.txt, tidak bisa diambil otomatis (Tomi bisa membukanya manual di browser: https://www.zenius.net/blog/contoh-soal-tka-matematika-sd/, /contoh-soal-tka-matematika-smp/, /contoh-soal-tka-bahasa-indonesia-sd/, /contoh-soal-tka-bahasa-indonesia-smp/)
- Artikel detik.com "30 Soal TKA Bahasa Indonesia SD 2026" — dicek isinya, ternyata IDENTIK dengan soal resmi Pusmendik di atas (sekadar reprint), bukan soal baru.

---

## Rekomendasi pemakaian dokumen ini

Gunakan sebagai bahan pembanding kualitatif, bukan kuantitatif: baca ulang beberapa soal hasil generate AI soal.ayotka.id berdampingan dengan contoh di atas, lalu nilai apakah gaya bahasa, kedalaman penalaran, variasi konteks, dan pola stimulus groupnya terasa setara. Pertimbangkan juga menjadikan sebagian soal resmi ini (dengan modifikasi substansial — bukan salinan identik) sebagai few-shot example di system prompt Gemini, khususnya untuk pola yang belum konsisten muncul di hasil generate saat ini (dua-teks-antarteks, label kategori non-Benar/Salah, dan grup 3-nomor dari satu stimulus panjang).

---

## POLA 11 — KARAKTERISTIK TEKS BACAAN BAHASA INDONESIA (DIUKUR, 1 Oktober 2026)

Diambil langsung dari tab "Contoh Soal" Pusmendik (SMP: /tka/tka/view/mata-pelajaran-wajib/smp/Bahasa-Indonesia; SD: /tka/tka/view/mata-pelajaran-wajib/sd/Bahasa-Indonesia). Hanya teks yang tersedia utuh sebagai teks yang diukur. Teks berbentuk gambar (ulasan pantai, puisi, pidato, surat Margaret Hamilton, infografis air/gigi/kerupuk) tidak dihitung. Kalimat dipisah berdasarkan tanda titik/tanya/seru, kata dihitung berdasarkan spasi.

### Pembanding angka Perkaban BSKAP 47/2025
| | SD/MI (hlm. 9) | SMP/MTs (hlm. 16) |
|---|---|---|
| Kata per kalimat | 3–7, pola dasar SPOK | 5–9, kalimat tunggal berbagai pola, majemuk setara |
| Panjang teks | 150–200 kata | 200–250 kata |
| Wacana | kohesi pengacuan, konjungsi antarparagraf penambahan/penjelasan | kohesi penyulihan, konjungsi antarparagraf perbandingan dan penekanan |

### SMP — 4 teks resmi (96 kalimat)
| Teks | Paragraf | Kata | Rata-rata kata/kalimat | Simpangan baku | Rentang | Kalimat 5–9 kata |
|---|---|---|---|---|---|---|
| Pelari Terakhir (fiksi terjemahan) | 7 | 239 | 8,0 | 2,4 | 3–12 | 67% |
| Desa Baduy (informasi) | 4 | 201 | 8,4 | 1,7 | 6–12 | 83% |
| Green Jobs (informasi) | 3 | 226 | 11,3 | 5,2 | 4–27 | 45% |
| Ayam Panggang Ponorogo (berita) | 4 | 185 | 8,4 | 2,0 | 6–15 | 77% |
| **Gabungan** | 3–7 | 185–239 | **8,9** | **3,3** | 3–27 | **69%** (28% >9 kata, 6% >12 kata) |

### SD — 3 teks resmi (87 kalimat)
| Teks | Paragraf | Kata | Rata-rata | Simpangan baku | Rentang | Kalimat 3–7 kata |
|---|---|---|---|---|---|---|
| Hewan Pemakan Daun (informasi) | 4 | 182 | 8,7 | 3,0 | 3–13 | 38% |
| Kenthus (fabel, banyak dialog) | 15 | 204 | 4,9 | 2,0 | 2–11 | 83% |
| Antre di Toko Buku (cerita) | 7 | 172 | 7,2 | 2,2 | 3–10 | 46% |
| **Gabungan** | 4–15 | 172–204 | **6,4** | **2,8** | 2–13 | **62%** (34% >7 kata) |

### Pembanding generator (audit 1 Oktober 2026)
| | Rata-rata kata/kalimat | Simpangan baku | Paragraf rata-rata |
|---|---|---|---|
| Generator SMP (164 stimulus) | 7,76 | 1,58 | 1,6 |
| Generator SD (131 stimulus) | 6,00 | 1,53 | 1,4 |
| Contoh: Posyandu / Karawitan (SMP) | 7,0 / 7,5 | 0,3 / 0,5 | 1 / 1 |

### Kesimpulan
1. Angka Perkaban dipakai Pusmendik sebagai patokan umum, bukan batas setiap kalimat. Sekitar dua pertiga kalimat resmi berada di rentang Perkaban, sisanya lebih pendek atau lebih panjang. Rata-rata teks informasi resmi bahkan melampaui batas atas (SD 8,7; SMP 11,3).
2. Pembeda utama teks resmi dengan teks generator adalah VARIASI panjang kalimat (simpangan baku 2–5 vs 0,3–1,6) dan PARAGRAF (semua teks resmi 3 paragraf atau lebih), bukan rata-ratanya.
3. Teks resmi memakai anak kalimat sederhana satu lapis (karena, bahwa, agar, yang, jika), baik di SD maupun SMP.
4. Penjelasan istilah: teks informasi SD menjelaskan konsep yang memang menjadi topik secara alami di dalam teks (aposisi, "yaitu", "disebut"). Teks SMP menaruh istilah asing di "Daftar Istilah" terpisah. Tidak ada teks resmi yang menyisipkan kalimat definisi untuk kata umum di tengah alur.
5. Kohesi dan penghubung dipakai wajar: Namun, Selain itu, Karena itu, Hal ini/Hal tersebut, Kemudian, Akhirnya.
