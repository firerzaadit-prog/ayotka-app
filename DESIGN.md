---
name: AyoTKA — Kartu Peserta Ujian
description: Homepage publik dibangun sebagai kartu peserta ujian resmi yang "terbuka" - bukan template SaaS generik.
colors:
  paper: "#F7F2E4"
  ink: "#1E2A52"
  seal: "#AD7A25"
  competency-good: "#059669"
  competency-mid: "#D97706"
  competency-low: "#E11D48"
typography:
  display:
    fontFamily: "Domine, Georgia, serif"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Cutive Mono, ui-monospace, monospace"
    letterSpacing: "0.14em"
rounded:
  none: "0px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  seal-badge:
    backgroundColor: "{colors.seal}"
    textColor: "{colors.seal}"
    rounded: "9999px"
---

## Overview

AyoTKA's homepage (`app/(public)/page.tsx` dan section-nya di `components/public/landing/`) dibangun sebagai satu **kartu peserta ujian** yang "terbuka" di depan pengunjung - bukan halaman fitur generik dengan hero+kartu-fitur+harga seperti kebanyakan produk SaaS. Ini adalah arah desain hasil proses `impeccable new-work` (direction index 7/7, seed key `181e37ef`, mode Persuade), dipilih untuk mengganti identitas lama yang teridentifikasi sebagai pola generik ("AI slop"): kicker/eyebrow di atas tiap heading, kartu ikon+judul+teks berukuran sama sebagai struktur halaman, dan gradient indigo/violet + rounded-2xl yang bisa jadi produk apa saja.

Thesis: pengunjung merasa sedang memegang kartu ujian miliknya sendiri - nomor peserta, kotak foto, judul dicetak sebagai bagian kartu - lalu "menyobek" ke bawah untuk melihat hasil peta kompetensi asli. Setiap section lain adalah halaman/lampiran dari dokumen resmi yang sama, bukan kartu-kartu lepas yang tidak berhubungan.

**Cakupan**: hanya route group `app/(public)/` (homepage + header/footer publik). Dashboard aplikasi (siswa/admin/mitra/dll) TIDAK ikut berubah - tetap pakai identitas lama (Poppins, indigo/violet) yang sudah mapan untuk konteks "Operate", bukan "Persuade". Font baru dipasang scoped lewat `app/(public)/layout.tsx`, tidak menimpa `--font-poppins`/`--font-mono` global.

Halaman `/kerangka-asesmen` (`components/public/kerangka-asesmen-client.tsx`) memakai sistem yang sama, dengan penekanan lebih ke keterbacaan (Domine cuma di H1, sisanya Public Sans) karena mode-nya Read/dokumentasi, bukan Persuade.

## Colors

- **paper** `#F7F2E4` - ground utama, krem kertas dokumen resmi (bukan putih polos). Dipakai polos atau dengan tekstur titik halus (`.card-paper-texture` di `app/globals.css`) untuk kesan kertas keamanan/watermark.
- **ink** `#1E2A52` - satu-satunya warna tinta utama: teks, border, tombol primer, latar footer & CTA penutup. Menggantikan gradient indigo→violet sepenuhnya - tidak ada gradient di sistem ini.
- **seal** `#AD7A25` (emas pudar) - aksen tunggal untuk "stempel resmi": badge status (`Seal` di `kit.tsx`), highlight kecil. Dipakai sedikit, sengaja tidak untuk area luas.
- **competency-good/mid/low** (emerald-600/amber-600/rose-600) - warna semantik untuk bar peta kompetensi (baik/cukup/kurang). Ini data, bukan brand - jangan diganti jadi ink/seal.

Strategi warna: **Full palette** (paper + ink + seal + semantik), bukan gradient. Ground selalu terang (paper) - dokumen resmi dibaca di cahaya terang, bukan gelap.

## Typography

- **Domine** (`font-card-serif`) - semua heading (h1-h3). Serif tegap, bergaya buku/dokumen resmi, sengaja bukan Fraunces/Playfair/dsb (font "AI-default" yang dihindari).
- **Public Sans** (`font-card`) - semua body text & label tombol. Dipilih karena aslinya font resmi pemerintah (US Web Design System) - cocok tematik dengan "dokumen resmi ujian negara".
- **Cutive Mono** (`font-card-mono`) - nomor ujian, skor, tanggal, label bidang formulir (`FieldLabel`, `ExamNumber` di `kit.tsx`). Karakter mesin tik/kartu ID lama, dipakai HANYA untuk data/angka, bukan body text.

**Kicker/eyebrow di atas heading DIHAPUS TOTAL** dari sistem ini (pola generik yang jadi temuan utama saat audit) - heading berdiri sendiri tanpa label mengambang di atasnya. Kalau perlu label kategori, integrasikan sebagai bagian form/field (lihat Components), bukan eyebrow terpisah.

## Layout

Section umumnya `max-w-3xl` sampai `max-w-6xl`, padding horizontal `px-4 sm:px-6`. Ground section berselang-seling antara `bg-card-paper` polos dan `.card-paper-texture` (bertekstur) untuk ritme, tanpa warna lain di antaranya.

## Shapes

**Tidak ada rounded-2xl / rounded-full pada kartu atau tombol.** Semua panel & tombol bersudut siku (`rounded-none`, default) - meniru dokumen/formulir resmi, bukan kartu SaaS. Pengecualian: `Seal` (badge status) tetap `rounded-full` karena meniru bentuk stempel/cap bulat, dan lingkaran kecil pada `Perforation`.

Panel penting (`KartuFrame` di `kit.tsx`) mendapat 4 aksen sudut siku-siku kecil (bracket) di tiap pojok - motif "target/ID card corner", pengganti shadow/rounded-corner sebagai penanda "ini panel penting".

## Elevation & Depth

Sistem ini flat - tidak ada box-shadow. Hierarki dibentuk lewat border (`border-card-ink/15` dst) dan warna latar (`bg-white` vs `bg-card-paper`), bukan bayangan.

## Components

- **KartuFrame** (`components/public/landing/kit.tsx`): panel utama - border tipis + 4 corner bracket. Dipakai untuk hero card, tabel Beda, kartu Jalur, kartu Harga, panel Kerangka Asesmen.
- **Perforation**: garis titik-titik horizontal ("sobek di sini") sebagai pemisah dalam satu kartu (mis. antara form hero dan hasil peta kompetensi). Bukan pemisah antar-section biasa - pakai hanya saat benar-benar merepresentasikan "kartu → lampiran hasil".
- **FieldLabel**: label kecil mono-uppercase bergaya bidang formulir - pengganti kicker/eyebrow, SELALU menempel langsung ke konten yang dilabeli (bukan eyebrow lepas di atas heading).
- **ExamNumber**: angka bergaya kartu ujian (`font-card-mono`, `tabular-nums`) untuk skor, tanggal, nomor urut.
- **Seal**: badge bulat kecil gaya stempel (emas) untuk status "resmi/unggulan" (mis. "Paling banyak dipakai").
- **Tombol primer**: `border border-card-ink bg-card-ink text-card-paper`, hover `-translate-y-0.5` (efek "terangkat", bukan shadow-grow). Tombol sekunder: border ink tipis, bg putih/transparan.

## Do's and Don'ts

**Do:**
- Pakai `KartuFrame`/`FieldLabel`/`ExamNumber`/`Seal` dari `kit.tsx` untuk section baru di homepage, jangan bikin ulang pola serupa dari nol.
- Pertahankan satu warna ink (`card-ink`) sebagai tinta utama - aksen `card-seal` dipakai sedikit dan sengaja.
- Baris/ledger (border-top antar-item dalam satu frame) untuk daftar 2+ item sejenis (lihat Siapa, Mapel, Cara Kerja) - BUKAN kartu-kartu terpisah berukuran sama.

**Don't:**
- Jangan tambahkan kicker/eyebrow di atas heading baru manapun - ini pola yang sengaja dihapus.
- Jangan pakai gradient indigo/violet lagi di area manapun dalam sistem ini - itu identitas lama yang diganti.
- Jangan pakai `rounded-2xl`/`rounded-full` untuk panel/kartu konten - sudut siku + corner bracket adalah bahasa bentuk sistem ini.
- Jangan tambahkan `border-l`/`border-r` berwarna di atas 1px pada callout/list item sebagai aksen dekoratif.
- Jangan sebarkan identitas ini ke luar `app/(public)/` (dashboard aplikasi tetap pakai sistem Poppins/indigo yang sudah ada) tanpa keputusan eksplisit baru.
