"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import {
  KONFIG_HARGA_LA_BAWAAN,
  LANGKAH_HARGA_LA,
  contohHargaLA,
  validasiKonfigHargaLA,
  type KonfigHargaLA,
} from "@/lib/billing/harga-la";
import { kesimpulanKalibrasi, type KalibrasiAi } from "@/lib/billing/kalibrasi-tampilan";

/** Isian form (teks, seperti yang diketik admin). */
export type IsianHargaLA = { hargaMin: string; hargaMaks: string; bebanRingan: string; bebanBerat: string };

const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const angka = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export const keIsian = (k: KonfigHargaLA): IsianHargaLA => ({
  hargaMin: String(k.hargaMin),
  hargaMaks: String(k.hargaMaks),
  bebanRingan: String(k.bebanRingan),
  bebanBerat: String(k.bebanBerat),
});

/** Isian teks -> pengaturan yang sudah diperiksa, atau pesan galat (isian kosong atau bukan angka dianggap tidak sah). */
export function periksaIsianHargaLA(isian: IsianHargaLA): { ok: true; konfig: KonfigHargaLA } | { ok: false; error: string } {
  const ke = (t: string) => (t.trim() === "" ? Number.NaN : Number(t.trim()));
  return validasiKonfigHargaLA({
    hargaMin: ke(isian.hargaMin),
    hargaMaks: ke(isian.hargaMaks),
    bebanRingan: ke(isian.bebanRingan),
    bebanBerat: ke(isian.bebanBerat),
  });
}

/**
 * Pratinjau harga menurut beban AI untuk isian yang sedang diketik; bila isiannya belum sah, pesan galatnya. Bila sudah ada
 * `rasio` (pemakaian nyata dibagi taksiran), ditambah kolom perkiraan token nyata.
 */
export function PratinjauHargaLA({ isian, rasio = null }: { isian: IsianHargaLA; rasio?: number | null }) {
  const hasil = periksaIsianHargaLA(isian);
  if (!hasil.ok) {
    return (
      <p className="text-sm text-amber-700" role="status">
        Pratinjau belum bisa ditampilkan: {hasil.error}
      </p>
    );
  }
  const contoh = contohHargaLA(hasil.konfig);
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700">Contoh harga ke siswa menurut beban AI paket</p>
      <TableContainer>
        <Table>
          <Thead>
            <Tr>
              <Th>Beban AI paket (taksiran token)</Th>
              <Th>Setara kira-kira</Th>
              {rasio !== null && <Th>Pemakaian nyata kira-kira</Th>}
              <Th>Harga satu Learning Analytics</Th>
            </Tr>
          </Thead>
          <tbody>
            {contoh.map((c) => (
              <Tr key={c.beban}>
                <Td>{angka(c.beban)} token</Td>
                <Td className="whitespace-nowrap">{c.perkiraanSoal} soal biasa</Td>
                {rasio !== null && <Td>{angka(Math.round(c.beban * rasio))} token</Td>}
                <Td className="font-semibold text-slate-900">{rupiah(c.harga)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>
      <p className="mt-2 text-xs text-slate-500">
        &quot;Soal biasa&quot; = soal dengan teks sekitar 300 karakter dan pembahasan sekitar 500 karakter. Paket dengan soal yang
        lebih panjang atau pembahasan yang lebih panjang terhitung lebih berat daripada jumlah soalnya.
      </p>
    </div>
  );
}

/** Kartu "Pemakaian AI sebenarnya": token nyata yang dicatat tiap analisis dibandingkan dengan taksiran yang menentukan harga. */
export function KartuPemakaianAi({ kalibrasi }: { kalibrasi: KalibrasiAi | null }) {
  const kesimpulan = kesimpulanKalibrasi(kalibrasi);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" data-kartu-pemakaian-ai>
      <p className="text-sm font-medium text-slate-800">Pemakaian AI sebenarnya{kalibrasi ? ` (${kalibrasi.hari} hari terakhir)` : ""}</p>
      {kalibrasi && kalibrasi.jumlah > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Analisis tercatat</dt>
            <dd className="font-semibold text-slate-900">{angka(kalibrasi.jumlah)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Rata-rata token masuk (nyata)</dt>
            <dd className="font-semibold text-slate-900">{kalibrasi.rataTokenMasuk === null ? "-" : angka(kalibrasi.rataTokenMasuk)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Rata-rata taksiran beban</dt>
            <dd className="font-semibold text-slate-900">{kalibrasi.rataTaksiran === null ? "-" : angka(kalibrasi.rataTaksiran)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Rata-rata token keluar (nyata)</dt>
            <dd className="font-semibold text-slate-900">{kalibrasi.rataTokenKeluar === null ? "-" : angka(kalibrasi.rataTokenKeluar)}</dd>
          </div>
        </dl>
      ) : null}
      <p className={`mt-3 text-sm ${kesimpulan.cukup ? "text-slate-700" : "text-amber-700"}`}>{kesimpulan.teks}</p>
      <p className="mt-1 text-xs text-slate-500">
        Token dicatat dari laporan resmi Gemini untuk tiap analisis. Kolom &quot;Pemakaian nyata kira-kira&quot; pada contoh harga di
        bawah memakai perbandingan ini: kalau Anda ingin harga mengikuti pemakaian nyata tertentu, atur batas ringan/berat sampai
        kolom itu menunjukkan angka yang Anda maksud.
      </p>
    </div>
  );
}

/**
 * Pengaturan harga Learning Analytics tambahan di Admin Pusat > Paket & Rekening. Harganya mengikuti beban AI paket
 * (lib/billing/harga-la.ts): makin berat prompt analisis (banyak dan panjang soal beserta pembahasannya), makin besar modalnya.
 */
export function HargaLaPengaturan() {
  const [isian, setIsian] = useState<IsianHargaLA | null>(null);
  const [kalibrasi, setKalibrasi] = useState<KalibrasiAi | null>(null);
  const [memuatGalat, setMemuatGalat] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [tersimpan, setTersimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    let abaikan = false;
    (async () => {
      const res = await fetch("/api/admin-pusat/wallet-settings", { cache: "no-store" }).catch(() => null);
      const data = await res?.json().catch(() => null);
      if (abaikan) return;
      if (!res?.ok || !data?.konfig) {
        setMemuatGalat(data?.error ?? "Gagal memuat pengaturan harga Learning Analytics.");
        return;
      }
      setIsian(keIsian(data.konfig as KonfigHargaLA));
      setKalibrasi((data.kalibrasi as KalibrasiAi | null | undefined) ?? null);
    })();
    return () => {
      abaikan = true;
    };
  }, []);

  function ubah(kunci: keyof IsianHargaLA, nilai: string) {
    setIsian((i) => (i ? { ...i, [kunci]: nilai } : i));
    setTersimpan(false);
    setGalat(null);
  }

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (!isian) return;
    setTersimpan(false);
    const hasil = periksaIsianHargaLA(isian);
    if (!hasil.ok) {
      setGalat(hasil.error);
      return;
    }
    setGalat(null);
    setMenyimpan(true);
    try {
      const res = await fetch("/api/admin-pusat/wallet-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hasil.konfig),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setGalat(data?.error ?? "Gagal menyimpan pengaturan harga.");
        return;
      }
      if (data?.konfig) setIsian(keIsian(data.konfig as KonfigHargaLA));
      setTersimpan(true);
    } catch {
      setGalat("Koneksi bermasalah. Coba lagi.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="judul-harga-la">
      <div>
        <h2 id="judul-harga-la" className="text-lg font-semibold text-slate-900">
          Harga Learning Analytics Tambahan
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Harga satu Learning Analytics tambahan (didebit dari saldo wallet siswa) begitu jatah gratis dari plan sudah habis.
          Harganya mengikuti <strong>beban AI paket</strong>: makin banyak dan makin panjang soal beserta pembahasan yang
          dianalisis AI, makin besar modalnya, jadi makin tinggi harganya. Paket yang sama selalu berharga sama bagi semua
          siswa, jadi harga sudah bisa ditampilkan sebelum ujian.
        </p>
      </div>

      {memuatGalat && <Alert variant="danger">{memuatGalat}</Alert>}
      {!isian && !memuatGalat && (
        <p className="text-sm text-slate-500" role="status">
          Memuat pengaturan harga...
        </p>
      )}

      {isian && (
        <form onSubmit={simpan} className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          {galat && <Alert variant="danger">{galat}</Alert>}

          <KartuPemakaianAi kalibrasi={kalibrasi} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="hargaLaMin">Harga minimum (Rp)</Label>
              <Input
                id="hargaLaMin"
                type="number"
                inputMode="numeric"
                min={LANGKAH_HARGA_LA}
                step={LANGKAH_HARGA_LA}
                required
                value={isian.hargaMin}
                onChange={(e) => ubah("hargaMin", e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">Untuk paket yang beban AI-nya ringan.</p>
            </div>
            <div>
              <Label htmlFor="hargaLaMaks">Harga maksimum (Rp)</Label>
              <Input
                id="hargaLaMaks"
                type="number"
                inputMode="numeric"
                min={LANGKAH_HARGA_LA}
                step={LANGKAH_HARGA_LA}
                required
                value={isian.hargaMaks}
                onChange={(e) => ubah("hargaMaks", e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">Untuk paket yang beban AI-nya berat.</p>
            </div>
            <div>
              <Label htmlFor="bebanRinganLa">Beban ringan: sampai (token)</Label>
              <Input
                id="bebanRinganLa"
                type="number"
                inputMode="numeric"
                min={100}
                required
                value={isian.bebanRingan}
                onChange={(e) => ubah("bebanRingan", e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">Beban sebesar ini atau kurang = harga minimum.</p>
            </div>
            <div>
              <Label htmlFor="bebanBeratLa">Beban berat: mulai (token)</Label>
              <Input
                id="bebanBeratLa"
                type="number"
                inputMode="numeric"
                min={101}
                required
                value={isian.bebanBerat}
                onChange={(e) => ubah("bebanBerat", e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">Beban sebesar ini atau lebih = harga maksimum.</p>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-500">
            Di antara kedua batas itu harga naik bertahap dan dibulatkan ke Rp{LANGKAH_HARGA_LA} terdekat. Harga minimum dan
            maksimum diisi dalam kelipatan Rp{LANGKAH_HARGA_LA}. Beban AI paket ditaksir dari isinya (teks soal, pilihan jawaban,
            dan pembahasan) dengan asumsi separuh soal dijawab salah, karena kunci dan pembahasan soal yang salah ikut dikirim
            ke AI.
          </p>

          <PratinjauHargaLA isian={isian} rasio={kalibrasi && kalibrasi.jumlah > 0 ? kalibrasi.rasio : null} />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={menyimpan}>
              {menyimpan ? "Menyimpan..." : "Simpan harga"}
            </Button>
            <Button type="button" variant="secondary" disabled={menyimpan} onClick={() => { setIsian(keIsian(KONFIG_HARGA_LA_BAWAAN)); setTersimpan(false); setGalat(null); }}>
              Isi dengan nilai bawaan ({rupiah(KONFIG_HARGA_LA_BAWAAN.hargaMin)} - {rupiah(KONFIG_HARGA_LA_BAWAAN.hargaMaks)})
            </Button>
            {tersimpan && <span className="text-sm text-emerald-600">Tersimpan.</span>}
          </div>
        </form>
      )}
    </section>
  );
}
