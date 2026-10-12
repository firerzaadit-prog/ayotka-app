"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { formatWIB } from "@/lib/utils/datetime";
import { DAFTAR_KODE_PRODUK, KODE_PRODUK_AFFILIATE, type KodeProdukAffiliate } from "@/lib/billing/affiliate-produk";

export type AlamatAffiliate = {
  purchase: string;
  checkEmail: string;
  checkAccount: string;
  success: Record<KodeProdukAffiliate, string>;
};
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
  /** Data mentah yang diterima server (kunci -> isi); null untuk catatan lama yang belum menyimpannya. */
  dataDiterima?: Record<string, string> | null;
};

type BarisAlamat = { kunci: string; label: string; tempat: string; nilai: (a: AlamatAffiliate) => string };

/** Alamat yang SAMA untuk semua produk. */
const BARIS_UMUM: BarisAlamat[] = [
  { kunci: "purchase", label: "Webhook Purchase", tempat: "Integrasi Webhook > Webhook Purchase", nilai: (a) => a.purchase },
  { kunci: "checkEmail", label: "Check Email Address Endpoint", tempat: "Saas Configuration", nilai: (a) => a.checkEmail },
  { kunci: "checkAccount", label: "Check Account/Slug Endpoint", tempat: "Saas Configuration", nilai: (a) => a.checkAccount },
];

/** Alamat Success: BERBEDA untuk tiap produk. */
const BARIS_SUCCESS: BarisAlamat[] = DAFTAR_KODE_PRODUK.map((kode) => ({
  kunci: `success-${kode}`,
  label: `Produk ${KODE_PRODUK_AFFILIATE[kode].label}`,
  tempat: "Saas Configuration > Success (New User) DAN Success (Existing User), isi keduanya dengan alamat ini",
  nilai: (a: AlamatAffiliate) => a.success[kode],
}));

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
              <Td className="text-xs text-slate-600">
                {c.pesan ?? c.kode ?? "-"}
                {c.dataDiterima && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-slate-500">Data yang diterima</summary>
                    <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-600">
                      {Object.entries(c.dataDiterima)
                        .map(([kunci, isi]) => `${kunci}: ${isi}`)
                        .join("\n")}
                    </pre>
                  </details>
                )}
              </Td>
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

function BarisSalin({
  baris,
  nilai,
  tersalin,
  onSalin,
}: {
  baris: BarisAlamat;
  nilai: string;
  tersalin: boolean;
  onSalin: (kunci: string, nilai: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-700">
        {baris.label} <span className="font-normal text-slate-400">&middot; {baris.tempat}</span>
      </p>
      <div className="mt-1 flex gap-2">
        <input
          readOnly
          value={nilai}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={baris.label}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
        />
        <Button type="button" variant="secondary" onClick={() => onSalin(baris.kunci, nilai)} className="shrink-0">
          {tersalin ? "Tersalin" : "Salin"}
        </Button>
      </div>
    </div>
  );
}

/** Alamat yang harus diisikan admin ke affiliate.id: tiga alamat umum, lalu satu alamat Success per produk. */
export function DaftarAlamatAffiliate({
  alamat,
  tersalin,
  onSalin,
}: {
  alamat: AlamatAffiliate;
  tersalin: string | null;
  onSalin: (kunci: string, nilai: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {BARIS_UMUM.map((b) => (
        <BarisSalin key={b.kunci} baris={b} nilai={b.nilai(alamat)} tersalin={tersalin === b.kunci} onSalin={onSalin} />
      ))}
      <p className="mt-2 text-xs font-semibold text-slate-700">
        Success (New User) dan Success (Existing User): alamat BERBEDA untuk tiap produk
      </p>
      {BARIS_SUCCESS.map((b) => (
        <BarisSalin key={b.kunci} baris={b} nilai={b.nilai(alamat)} tersalin={tersalin === b.kunci} onSalin={onSalin} />
      ))}
    </div>
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
        affiliate.id (<em>Edit Produk</em>) untuk SETIAP produk AyoTKA (Top Up 25.000, Top Up 50.000, Bulanan, Semester). Tiga alamat pertama sama
        untuk semua produk. Alamat Success BERBEDA untuk tiap produk, karena affiliate.id tidak memberi tahu produk apa yang dibeli: pakai alamat
        yang sesuai produknya (tertukar berarti saldo atau paket yang masuk salah). Panggilan tanpa kode rahasia ditolak. Jangan bagikan alamat ini.
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

      {alamat && <DaftarAlamatAffiliate alamat={alamat} tersalin={tersalin} onSalin={salin} />}

      <h3 className="mt-6 text-sm font-semibold text-slate-900">Panggilan yang perlu ditindaklanjuti</h3>
      <p className="mb-2 text-xs text-slate-500">
        Pembayaran yang sudah masuk di affiliate.id tetapi tidak bisa diproses otomatis (email tidak cocok dengan akun, produk tidak dikenal) atau
        diduga terkirim dua kali. Yang gagal: aktifkan lewat Aktivasi Manual di bawah.
      </p>
      <DaftarCallbackBermasalah daftar={gagal} />
    </Card>
  );
}
