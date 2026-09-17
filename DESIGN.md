---
name: AyoTKA Unified Design System
description: Modern, high-craft design system for AyoTKA with Poppins typography, vibrant indigo/violet gradients, frosted glass navigation, and tactile rounded surfaces across public pages and multi-role dashboards.
colors:
  primary:
    from: "#4F46E5" # indigo-600
    to: "#7C3AED"   # violet-600
  accent:
    indigo-50: "#EEF2FF"
    violet-50: "#F5F3FF"
    indigo-100: "#E0E7FF"
    indigo-500: "#6366F1"
  ground:
    dashboard: "#F8FAFC" # slate-50/70
    card: "#FFFFFF"
    header: "rgba(255, 255, 255, 0.90)"
  border:
    subtle: "rgba(226, 232, 240, 0.8)" # slate-200/80
    default: "#E2E8F0" # slate-200
  text:
    primary: "#0F172A" # slate-900
    secondary: "#475569" # slate-600
    muted: "#64748B" # slate-500
    hint: "#94A3B8" # slate-400
  semantic:
    success:
      bg: "#ECFDF5" # emerald-50
      text: "#047857" # emerald-700
      border: "rgba(167, 243, 208, 0.7)"
    warning:
      bg: "#FFFBEB" # amber-50
      text: "#92400E" # amber-800
      border: "rgba(253, 230, 138, 0.7)"
    danger:
      bg: "#FFF1F2" # rose-50
      text: "#BE123C" # rose-700
      border: "rgba(254, 205, 211, 0.7)"
    info:
      bg: "#EEF2FF" # indigo-50
      text: "#4338CA" # indigo-700
      border: "rgba(199, 210, 254, 0.7)"
typography:
  fontFamily:
    sans: "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    mono: "IBM Plex Mono, ui-monospace, monospace"
rounded:
  card: "1rem" # rounded-2xl (16px)
  button: "0.75rem" # rounded-xl (12px)
  badge: "9999px" # rounded-full
---

# AyoTKA Unified Design System

Dokumentasi sistem desain AyoTKA yang menyelaraskan estetika visual halaman publik (homepage & kerangka asesmen) dan 5 portal dashboard (**Siswa**, **Admin Pusat**, **Admin Sekolah**, **Reseller/Mitra**, dan **Dinas Pendidikan**).

## 1. Filosofi & Karakter Visual

- **Harmonis & Terintegrasi**: Halaman publik dan dashboard berbagi identitas visual yang sama (palet warna indigo-violet, tipografi Poppins, sudut lembut `rounded-2xl` / `rounded-xl`, dan header frosted glass).
- **Operate Surface yang Efisien**: Pada dashboard, tujuan utama adalah kemudahan pemindaian data (*high scanability*), hierarki informasi yang jelas, dan umpan balik mikro-interaksi yang terukur tanpa animasi berlebihan.
- **Kerapian Data**: Nomor kode, statistik, dan identifier menggunakan tipografi monospace (`IBM Plex Mono`) dengan label berukuran kecil (`text-xs font-semibold uppercase tracking-wider`).

## 2. Palet Warna & Token

### Brand Gradient
- `bg-gradient-to-r from-indigo-600 to-violet-600`
- Digunakan untuk: tombol primer, active link pill di sidebar navigasi, aksen branding header, dan hero elements.
- Efek shadow: `shadow-sm shadow-indigo-600/25 hover:shadow-md hover:shadow-indigo-600/35`.

### Latar Belakang & Ground
- **Dashboard Shell Ground**: `bg-slate-50/70` memberikan kontras lembut terhadap kartu putih murni.
- **Header Shell**: `bg-white/90 backdrop-blur-md border-b border-slate-200/80` memberikan efek frosted glass modern dan elegan.
- **Container / Cards**: `bg-white border border-slate-200/80 shadow-sm rounded-2xl`.

### Semantik Status Badges
- **Aktif / Selesai (Success)**: `bg-emerald-50 text-emerald-700 border-emerald-200/70`
- **Menunggu Verifikasi / Pending (Warning)**: `bg-amber-50 text-amber-800 border-amber-200/70`
- **Suspend / Gagal (Danger)**: `bg-rose-50 text-rose-700 border-rose-200/70`
- **Info / Draft**: `bg-indigo-50 text-indigo-700 border-indigo-200/70`
- **Netral**: `bg-slate-50 text-slate-600 border-slate-200/80`

## 3. Komponen UI Inti

### DashboardShell & Navigation
- **Header**: Logo AyoTKA + badge peran dalam kapsul gradien halus (`bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 border-indigo-100/60`).
- **User Indicator**: Pill email pengguna dilengkapi status dot hijau aktif (`bg-emerald-500 ring-2 ring-white`).
- **Sidebar Nav**: 
  - Judul bagian (*section header*): `font-mono text-[0.68rem] font-semibold uppercase tracking-wider text-indigo-600/80`.
  - Item aktif (*active link*): kapsul gradien `from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-600/25` dengan dot indikator putih.
  - Item non-aktif: `text-slate-600 hover:bg-indigo-50/60 hover:text-indigo-700 rounded-xl`.

### Tabel Data (`components/ui/table.tsx`)
- Container: `rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden`.
- Header (`Thead`): Latar gradien halus `bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 border-b border-slate-200/80`.
- Judul Kolom (`Th`): `font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5 px-4`.
- Baris Data (`Tr`): `hover:bg-indigo-50/20 transition-colors`.

### Tombol (`components/ui/button.tsx`)
- `rounded-xl px-4 py-2 text-sm font-medium tracking-tight transition-all duration-150`
- **Primary**: Gradien indigo-violet dengan bayangan halus, respon hover `brightness-105` dan respon klik `active:scale-[0.98]`.
- **Secondary**: `bg-white border-slate-200/90 text-slate-700 shadow-xs hover:bg-slate-50/80 hover:border-slate-300`.
- **Danger**: Gradien rose-red dengan bayangan rose halus.

### Form Input (`components/ui/input.tsx`)
- `rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs transition-all`
- Fokus state: `focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10`.

## 4. Panduan Implementasi (Do's & Don'ts)

### Do:
- Gunakan `font-sans` (Poppins) untuk teks umum dan heading, serta `font-mono` (IBM Plex Mono) untuk kode, angka ID, dan tabel label.
- Pertahankan struktur dan copywriting teks yang sudah ada 100% akurat.
- Gunakan komponen shared di `@/components/ui/*` agar semua peran (Siswa, Admin Pusat, Admin Sekolah, Mitra, Dinas Pendidikan) otomatis konsisten.
- Gunakan `rounded-2xl` untuk card/tabel container dan `rounded-xl` untuk input/button.

### Don't:
- Jangan menggunakan font serif (Domine) atau nuansa kertas kuning/krem (`#F7F2E4`) yang sudah diganti oleh pengguna.
- Jangan menggunakan sudut tajam (`rounded-none`).
- Jangan gunakan tombol aksi tabel yang hanya berupa teks bergaris bawah tanpa padding (`hover:underline`), gunakan pill tombol halus (`rounded-lg px-2.5 py-1 text-xs font-semibold hover:bg-rose-50`).
