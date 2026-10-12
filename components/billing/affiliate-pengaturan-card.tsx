"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { formatWIB } from "@/lib/utils/datetime";

export type AlamatAffiliate = { purchase: string; checkEmail: string; checkAccount: string; success: string };
export type CallbackBermasalah = {
  id: string;
  waktu: string;
  jenis: "gagal" | "ganda";
  kode: string | null;
  pesan: string | null;
  email: string | null;
  produk: string | null;
  nominal: number | null;
  nomorOrder: string | null;
};

const BARIS_ALAMAT: Array<{ kunci: keyof AlamatAffiliate; label: string; tempat: string }> = [
  { kunci: "purchase", label: "Webhook Purchase", tempat: "Integrasi Webhook > Webhook Purchase" },
  { kunci: "checkEmail", label: "Check Email Address Endpoint", tempat: "Saas Configuration" },
  { kunci: "checkAccount", label: "Check Account/Slug Endpoint", tempat: "Saas Configuration" },
  { kunci: "success", label: "Success (New User) dan Success (Existing User) Endpoint", tempat: "Saas Configuration (isi keduanya dengan alamat yang sama)" },
];

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

/** Daftar panggilan yang gagal/diduga ganda; dipisah supaya bisa dirender dan diuji tanpa jaringan. */
export function DaftarCallbackBermasalah({ daftar }: { daftar: CallbackBermasalah[] }) {
  if (daftar.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada panggilan yang gagal atau diduga ganda.</p>;
  }
  return (
    <TableContainer>
      <Table>
        <Thead>
          <Tr>
            <Th>Waktu</Th>
            <Th>Jenis</Th>
            <Th>Penyebab</Th>
            <Th>Email</Th>
            <Th>Produk</Th>
            <Th>Nominal</Th>
            <Th>No. order</Th>
          </Tr>
        </Thead>
        <tbody>
          {daftar.map((c) => (
            <Tr key={c.id}>
              <Td className="whitespace-nowrap text-xs text-slate-500">{formatWIB(c.waktu)}</Td>
              <Td>
                <Badge variant={c.jenis === "ganda" ? "warning" : "danger"}>{c.jenis === "ganda" ? "Diduga ganda" : "Gagal"}</Badge>
              </Td>
              <Td className="text-xs text-slate-600">{c.pesan ?? c.kode ?? "-"}</Td>
              <Td className="text-xs">{c.email ?? "-"}</Td>
              <Td className="text-xs">{c.produk ?? "-"}</Td>
              <Td className="text-xs">{c.nominal !== null ? rupiah(c.nominal) : "-"}</Td>
              <Td className="font-mono text-xs">{c.nomorOrder ?? "-"}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableContainer>
  );
}

/**
 * Pengaturan pembayaran otomatis affiliate.id: alamat yang harus diisikan admin (sudah membawa rahasia, tanpa rahasia
 * semua panggilan ditolak server) dan daftar pembayaran yang butuh tindak lanjut manual.
 */
export function AffiliatePengaturanCard() {
  const [alamat, setAlamat] = useState<AlamatAffiliate | null | undefined>(undefined);
  const [gagal, setGagal] = useState<CallbackBermasalah[]>([]);
  const [galat, setGalat] = useState<string | null>(null);
  const [tersalin, setTersalin] = useState<string | null>(null);

  useEffect(() => {
    let abaikan = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/affiliate/alamat", { cache: "no-store" }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (abaikan) return;
      if (!res?.ok || !data) {
        setGalat(data?.error ?? "Gagal memuat pengaturan pembayaran otomatis.");
        setAlamat(null);
        return;
      }
      setAlamat(data.alamat ?? null);
      setGagal(data.gagal ?? []);
    })();
    return () => {
      abaikan = true;
    };
  }, []);

  async function salin(kunci: string, nilai: string) {
    try {
      await navigator.clipboard.writeText(nilai);
      setTersalin(kunci);
      setTimeout(() => setTersalin((k) => (k === kunci ? null : k)), 2000);
    } catch {
      setGalat("Tidak bisa menyalin otomatis. Blok alamatnya lalu salin manual (Ctrl+C).");
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Pembayaran otomatis affiliate.id</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-500">
        Server hanya menerima panggilan dari affiliate.id yang membawa kode rahasia di alamatnya. Salin alamat di bawah ke pengaturan produk di
        affiliate.id (<em>Edit Produk</em>) untuk SETIAP produk AyoTKA (Top Up 25.000, Top Up 50.000, Bulanan, Semester). Panggilan tanpa kode ini
        ditolak, jadi alamat lama yang belum diganti tidak akan mengisi saldo. Jangan bagikan alamat ini.
      </p>

      {galat && (
        <Alert variant="danger" className="mt-3">
          {galat}
        </Alert>
      )}

      {alamat === null && !galat && (
        <Alert variant="warning" className="mt-3">
          Server belum punya kunci untuk membuat kode rahasia, jadi semua panggilan dari affiliate.id ditolak. Hubungi pengembang.
        </Alert>
      )}

      {alamat && (
        <div className="mt-4 flex flex-col gap-3">
          {BARIS_ALAMAT.map((b) => (
            <div key={b.kunci}>
              <p className="text-xs font-medium text-slate-700">
                {b.label} <span className="font-normal text-slate-400">&middot; {b.tempat}</span>
              </p>
              <div className="mt-1 flex gap-2">
                <input
                  readOnly
                  value={alamat[b.kunci]}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={b.label}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
                />
                <Button type="button" variant="secondary" onClick={() => salin(b.kunci, alamat[b.kunci])} className="shrink-0">
                  {tersalin === b.kunci ? "Tersalin" : "Salin"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold text-slate-900">Panggilan yang perlu ditindaklanjuti</h3>
      <p className="mb-2 text-xs text-slate-500">
        Pembayaran yang sudah masuk di affiliate.id tetapi tidak bisa diproses otomatis (email tidak cocok dengan akun, produk tidak dikenal) atau
        diduga terkirim dua kali. Yang gagal: aktifkan lewat Aktivasi Manual di bawah.
      </p>
      <DaftarCallbackBermasalah daftar={gagal} />
    </Card>
  );
}
