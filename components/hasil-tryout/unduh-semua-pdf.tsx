"use client";

import { useRef, useState } from "react";
import { Archive } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MAKS_BERKAS_UNDUH_MASSAL, unduhMassal, type HasilUnduhMassal, type ItemUnduh, type KemajuanUnduh } from "@/lib/hasil-tryout/unduh-massal";

/**
 * Tombol "Unduh semua PDF (ZIP)" di rincian paket: meminta rapor tiap siswa satu per satu (dua sekaligus) lalu menggabungkannya
 * menjadi satu ZIP di peramban. Menampilkan kemajuan, bisa dibatalkan, dan melaporkan rapor yang gagal. Aturan dan
 * penggabungannya ada di lib/hasil-tryout/unduh-massal.ts.
 */
export function UnduhSemuaPdf({ items, namaZip }: { items: ItemUnduh[]; namaZip: string }) {
  const [kemajuan, setKemajuan] = useState<KemajuanUnduh | null>(null);
  const [hasil, setHasil] = useState<HasilUnduhMassal | null>(null);
  const pembatal = useRef<AbortController | null>(null);
  const berjalan = kemajuan !== null;
  const terlaluBanyak = items.length > MAKS_BERKAS_UNDUH_MASSAL;

  async function mulai() {
    setHasil(null);
    setKemajuan({ selesai: 0, total: items.length, berhasil: 0, gagal: 0 });
    const kendali = new AbortController();
    pembatal.current = kendali;
    try {
      const h = await unduhMassal(items, { sinyal: kendali.signal, padaKemajuan: setKemajuan });
      setHasil(h);
      if (h.zip) {
        const url = URL.createObjectURL(new Blob([h.zip as BlobPart], { type: "application/zip" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = namaZip;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } finally {
      pembatal.current = null;
      setKemajuan(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3" data-unduh-semua>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={mulai} disabled={berjalan || terlaluBanyak} data-unduh-semua-tombol>
          <Archive size={16} className="mr-2" aria-hidden="true" />
          Unduh semua PDF (ZIP)
        </Button>
        <span className="text-xs text-slate-500">
          {terlaluBanyak
            ? `Terlalu banyak (${items.length} rapor, batas ${MAKS_BERKAS_UNDUH_MASSAL} per ZIP). Pilih satu jenis try out dulu.`
            : `${items.length} rapor dalam satu berkas ZIP`}
        </span>
      </div>

      {kemajuan && (
        <div className="rounded-xl border border-slate-200 bg-white p-4" role="status" aria-live="polite" data-kemajuan>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-slate-700">
              Menyiapkan rapor <span className="font-semibold text-slate-900">{Math.min(kemajuan.selesai + 1, kemajuan.total)}</span> dari {kemajuan.total}...
              {kemajuan.gagal > 0 && <span className="ml-2 text-amber-700">{kemajuan.gagal} gagal</span>}
            </p>
            <Button type="button" variant="secondary" onClick={() => pembatal.current?.abort()} data-unduh-semua-batal>
              Batal
            </Button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(kemajuan.selesai / Math.max(1, kemajuan.total)) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Biarkan halaman ini tetap terbuka sampai berkas ZIP terunduh sendiri.</p>
        </div>
      )}

      {hasil && !berjalan && (
        <div data-hasil-unduh-semua>
          {hasil.dibatalkan && <Alert variant="warning">Dibatalkan. Tidak ada berkas yang diunduh.</Alert>}
          {!hasil.dibatalkan && hasil.zip && (
            <Alert variant={hasil.gagal.length > 0 ? "warning" : "success"}>
              {hasil.berhasil} rapor sudah diunduh dalam satu ZIP.
              {hasil.gagal.length > 0 && (
                <>
                  {" "}
                  {hasil.gagal.length} rapor tidak bisa diunduh:
                  <ul className="mt-1 list-disc pl-5">
                    {hasil.gagal.map((g, i) => (
                      <li key={`${g.nama}-${i}`}>
                        {g.nama}: {g.alasan}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Alert>
          )}
          {!hasil.dibatalkan && !hasil.zip && (
            <Alert variant="danger">
              Tidak ada rapor yang berhasil diunduh.
              {hasil.gagal[0] && ` ${hasil.gagal[0].nama}: ${hasil.gagal[0].alasan}`}
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
