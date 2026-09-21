"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";

export type VoucherItem = {
  id: string;
  code: string;
  paket: string;
  status: "unused" | "used" | "expired" | "void";
  /** Sudah diformat di server (WIB) supaya tampilan tidak bergantung zona waktu browser. */
  dibeli: string;
  dipakai: string | null;
};

type Filter = "semua" | "unused" | "used";
const PER_HALAMAN = 50;

const STATUS_LABEL = { unused: "Belum aktif", used: "Aktif", expired: "Kedaluwarsa", void: "Dibatalkan" } as const;
const STATUS_VARIANT = { unused: "info", used: "success", expired: "warning", void: "neutral" } as const;

async function salin(teks: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    // Clipboard bisa diblokir (mis. halaman non-HTTPS); kode tetap tampil dan bisa diblok manual.
    return false;
  }
}

/**
 * Daftar kode voucher milik mitra. Satu voucher = satu kode unik = satu siswa.
 * "Aktif" = kode sudah dipakai siswa (identitas siswa sengaja tidak ditampilkan - hanya waktu aktifnya).
 */
export function VoucherCodeList({ items, baseUrl }: { items: VoucherItem[]; baseUrl: string }) {
  const [filter, setFilter] = useState<Filter>("semua");
  const [batas, setBatas] = useState(PER_HALAMAN);
  const [pesan, setPesan] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState<string | null>(null);

  const belumAktif = items.filter((v) => v.status === "unused");
  const aktif = items.filter((v) => v.status === "used");
  const tampil = items.filter((v) => filter === "semua" || v.status === filter);

  function beriTahu(teks: string) {
    setPesan(teks);
    setTimeout(() => setPesan(null), 3000);
  }

  async function salinKode(v: VoucherItem) {
    if (await salin(v.code)) {
      setTersalin(v.id);
      setTimeout(() => setTersalin((cur) => (cur === v.id ? null : cur)), 1500);
    } else beriTahu("Tidak bisa menyalin otomatis. Blok dan salin manual kodenya.");
  }

  async function salinTautan(v: VoucherItem) {
    const ok = await salin(`${baseUrl}/registrasi/mandiri?ref=${encodeURIComponent(v.code)}`);
    beriTahu(ok ? `Tautan pendaftaran untuk ${v.code} tersalin.` : "Tidak bisa menyalin otomatis.");
  }

  async function salinSemuaBelumAktif() {
    const ok = await salin(belumAktif.map((v) => v.code).join("\n"));
    beriTahu(ok ? `${belumAktif.length} kode belum aktif tersalin (satu kode per baris).` : "Tidak bisa menyalin otomatis.");
  }

  const chip = (nilai: Filter, label: string, jumlah: number) => (
    <button
      key={nilai}
      type="button"
      onClick={() => {
        setFilter(nilai);
        setBatas(PER_HALAMAN);
      }}
      aria-pressed={filter === nilai}
      className={
        filter === nilai
          ? "rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white"
          : "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      }
    >
      {label} <span className="opacity-80">({jumlah})</span>
    </button>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-lg font-semibold text-slate-900">Kode Voucher Siswa</h2>
          <p className="text-xs leading-relaxed text-slate-500">
            Setiap voucher yang kamu beli punya kode sendiri yang berbeda. Bagikan satu kode untuk satu siswa. Siswa
            menulis kodenya di kolom kode saat mendaftar (atau menukarnya di menu Langganan &amp; Voucher), lalu akunnya
            langsung berlangganan tanpa bayar. <strong className="font-semibold text-slate-700">Aktif</strong> berarti
            kode sudah dipakai siswa.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={salinSemuaBelumAktif}
          disabled={belumAktif.length === 0}
          className="shrink-0"
        >
          Salin semua kode belum aktif
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chip("semua", "Semua", items.length)}
        {chip("unused", "Belum aktif", belumAktif.length)}
        {chip("used", "Aktif", aktif.length)}
      </div>

      <p aria-live="polite" className="min-h-4 text-xs font-medium text-indigo-700">
        {pesan}
      </p>

      <TableContainer>
        <Table>
          <Thead>
            <Tr>
              <Th>Kode</Th>
              <Th>Paket</Th>
              <Th>Status</Th>
              <Th>Dibeli</Th>
              <Th>Aktif sejak</Th>
              {/* relative: teks sr-only itu absolut; tanpa ini ia lolos dari kotak-geser tabel dan melebarkan halaman di HP. */}
              <Th className="relative">
                <span className="sr-only">Aksi</span>
              </Th>
            </Tr>
          </Thead>
          <tbody>
            {tampil.slice(0, batas).map((v) => (
              <Tr key={v.id}>
                <Td>
                  <span className="select-all rounded border border-indigo-200/60 bg-indigo-50/70 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-indigo-700">
                    {v.code}
                  </span>
                </Td>
                <Td className="font-medium text-slate-900">{v.paket}</Td>
                <Td>
                  <Badge variant={STATUS_VARIANT[v.status]}>{STATUS_LABEL[v.status]}</Badge>
                </Td>
                <Td className="text-xs text-slate-500">{v.dibeli}</Td>
                <Td className="text-xs text-slate-500">{v.dipakai ?? "-"}</Td>
                <Td className="whitespace-nowrap text-right">
                  {v.status === "unused" && (
                    <div className="flex justify-end gap-1.5">
                      <Button type="button" variant="secondary" onClick={() => salinKode(v)}>
                        {tersalin === v.id ? "Tersalin" : "Salin kode"}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => salinTautan(v)}>
                        Salin tautan
                      </Button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
            {tampil.length === 0 && (
              <Tr>
                <Td colSpan={6} className="py-8 text-center text-sm text-slate-500">
                  Belum ada kode di kategori ini.
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableContainer>

      {tampil.length > batas && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={() => setBatas((b) => b + PER_HALAMAN)}>
            Tampilkan {Math.min(PER_HALAMAN, tampil.length - batas)} kode lagi
          </Button>
        </div>
      )}
    </section>
  );
}
