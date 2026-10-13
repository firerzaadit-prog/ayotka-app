"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alamatDenganFilter, buatQuery, type NilaiFilter } from "@/lib/hasil-tryout/alamat";

/**
 * Filter halaman laporan: disimpan di React dan disalin ke alamat (tanpa menambah riwayat peramban) supaya muat ulang atau
 * membagikan tautan tetap menampilkan hal yang sama. Mengubah filter selain `halaman` mengembalikan halaman ke 1.
 */
export function useFilterAlamat(jalur: string, awal: NilaiFilter, bawaan: NilaiFilter) {
  const [nilai, setNilai] = useState<NilaiFilter>({ ...bawaan, ...awal });
  const ubah = useCallback((sebagian: NilaiFilter) => {
    setNilai((lama) => {
      const baru = { ...lama, ...sebagian };
      if (!("halaman" in sebagian)) baru.halaman = "";
      return baru;
    });
  }, []);
  const query = useMemo(() => buatQuery(nilai, bawaan), [nilai, bawaan]);

  // Salin ke alamat setelah render (bukan di dalam pembaruan state).
  const pertama = useRef(true);
  useEffect(() => {
    if (pertama.current) {
      pertama.current = false;
      return;
    }
    window.history.replaceState(null, "", alamatDenganFilter(jalur, nilai, bawaan));
  }, [jalur, nilai, bawaan]);

  return { nilai, ubah, query };
}

type Hasil<T> = { kunci: string; data: T | null; galat: string | null };

/**
 * Mengambil JSON laporan untuk `query`. Data sebelumnya tetap tampil selama data baru dimuat (`memuat` true), jadi tabel
 * tidak berkedip saat filter diganti. Permintaan yang sudah usang diabaikan.
 */
export function useDataLaporan<T>(endpoint: string, query: string, kunciMuatUlang = 0) {
  const kunci = `${endpoint}?${query}#${kunciMuatUlang}`;
  const [hasil, setHasil] = useState<Hasil<T>>({ kunci: "", data: null, galat: null });

  useEffect(() => {
    let abaikan = false;
    const pembatal = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${endpoint}${query ? `?${query}` : ""}`, { cache: "no-store", signal: pembatal.signal });
        const json = await res.json().catch(() => null);
        if (abaikan) return;
        if (res.ok && json) setHasil({ kunci, data: json as T, galat: null });
        else setHasil((lama) => ({ kunci, data: lama.data, galat: json?.error ?? "Gagal memuat data." }));
      } catch (e) {
        if (abaikan || (e instanceof DOMException && e.name === "AbortError")) return;
        setHasil((lama) => ({ kunci, data: lama.data, galat: "Gagal memuat data. Periksa koneksimu lalu coba lagi." }));
      }
    })();
    return () => {
      abaikan = true;
      pembatal.abort();
    };
  }, [endpoint, query, kunci]);

  return { data: hasil.data, galat: hasil.kunci === kunci ? hasil.galat : null, memuat: hasil.kunci !== kunci };
}

/** Nilai yang baru dianggap berubah setelah `tunda` ms tanpa perubahan (untuk kotak pencarian). */
export function useTunda<T>(nilai: T, tunda = 350): T {
  const [tertunda, setTertunda] = useState(nilai);
  useEffect(() => {
    const t = setTimeout(() => setTertunda(nilai), tunda);
    return () => clearTimeout(t);
  }, [nilai, tunda]);
  return tertunda;
}
