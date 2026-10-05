"use client";

import { useEffect, useRef, useState } from "react";

type DataUrutan = { kunci: string; terpakai: number[]; berikutnya: number };

/**
 * Urutan seri yang sudah dipakai paket Mandiri pada mapel dan jenjang ini (GET /api/packages/urutan-seri), untuk
 * mencegah nomor ganda di form sebelum disimpan dan menyarankan nomor kosong berikutnya. Tiap jenjang punya urutannya
 * sendiri (Matematika SD urutan 1 dan Matematika SMP urutan 1 boleh sama). `excludePackageId` = paket yang sedang
 * diedit (nomornya sendiri tidak dihitung terpakai). `versi` dinaikkan pemanggil setiap data paket berubah (mis.
 * setelah menyimpan) supaya daftar dimuat ulang. `onSiap` dipanggil sekali tiap data baru selesai dimuat (untuk
 * mengisi otomatis nomor yang disarankan). Gagal memuat tidak memblokir form - server tetap menolak nomor ganda.
 */
export function useUrutanSeri(
  subjectId: string,
  jenjang: string,
  aktif: boolean,
  excludePackageId?: string,
  versi = 0,
  onSiap?: (berikutnya: number) => void,
) {
  const [data, setData] = useState<DataUrutan | null>(null);
  const kunci = `${subjectId}|${jenjang}|${excludePackageId ?? ""}|${versi}`;
  const onSiapTerbaru = useRef(onSiap);
  useEffect(() => {
    onSiapTerbaru.current = onSiap;
  });

  useEffect(() => {
    if (!aktif || !subjectId || !jenjang) return;
    let ignore = false;
    (async () => {
      const qs = new URLSearchParams({ subjectId, jenjang });
      if (excludePackageId) qs.set("exclude", excludePackageId);
      const res = await fetch(`/api/packages/urutan-seri?${qs}`, { cache: "no-store" });
      if (!res.ok || ignore) return;
      const json = (await res.json()) as { terpakai?: number[]; berikutnya?: number };
      if (ignore) return;
      const berikutnya = json.berikutnya ?? 1;
      setData({ kunci, terpakai: json.terpakai ?? [], berikutnya });
      onSiapTerbaru.current?.(berikutnya);
    })().catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [aktif, subjectId, jenjang, excludePackageId, kunci]);

  // Data milik mapel/paket lain (mapel baru diganti, muat ulang belum selesai) tidak dipakai.
  const sah = aktif && data && data.kunci === kunci ? data : null;
  return {
    siap: sah != null,
    memuat: aktif && subjectId !== "" && jenjang !== "" && sah == null,
    terpakai: sah?.terpakai ?? [],
    berikutnya: sah?.berikutnya ?? null,
  };
}
