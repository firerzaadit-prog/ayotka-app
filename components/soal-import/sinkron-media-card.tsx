"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import type { LaporanSinkronMedia, LaporanSinkronMediaPaket } from "@/lib/soal-import/sinkron-media";

const perluDicek = (p: LaporanSinkronMediaPaket) =>
  p.diagramTidakValid + p.tanpaFotoTersimpan + p.tidakBisaDicocokkan + p.berubahSaatProses + (p.galatSumber ? 1 : 0);

/** Hasil pemeriksaan/penerapan: ringkasan angka dan rincian per paket (hanya paket yang ada urusannya). */
export function RingkasanSinkronMedia({ laporan }: { laporan: LaporanSinkronMedia }) {
  const t = laporan.total;
  const paketBerurusan = laporan.paket.filter((p) => p.diperbarui > 0 || perluDicek(p) > 0);
  const paketDiperbarui = laporan.paket.filter((p) => p.diperbarui > 0).length;

  return (
    <div className="mt-4 flex flex-col gap-3" data-testid="ringkasan-sinkron-media" aria-live="polite">
      {laporan.jalankan ? (
        <Alert variant="success">
          <strong>{t.diperbarui}</strong> soal di {paketDiperbarui} paket sudah diperbarui menjadi dua gambar. Siswa akan melihat tab Diagram
          Presisi dan Foto Ilustrasi begitu soalnya dimuat ulang.
        </Alert>
      ) : t.diperbarui > 0 ? (
        <Alert variant="info">
          Ditemukan <strong>{t.diperbarui}</strong> soal di {paketDiperbarui} paket yang bisa dijadikan dua gambar. <strong>Belum ada yang diubah</strong>;
          tekan &quot;Terapkan&quot; bila daftarnya sudah sesuai.
        </Alert>
      ) : (
        <Alert variant="success">Tidak ada soal yang perlu diperbarui. Semua soal yang sumbernya punya diagram sudah menampilkan dua gambar.</Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge variant="success">{t.sudahGanda} soal sudah dua gambar</Badge>
        <Badge variant="neutral">{t.sumberSatuGambar} soal sumbernya hanya satu gambar</Badge>
        <Badge variant={t.perluDicek > 0 ? "warning" : "neutral"}>{t.perluDicek} perlu dicek</Badge>
        <Badge variant="info">{t.soal} soal di {t.paket} paket diperiksa</Badge>
      </div>

      {paketBerurusan.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Paket</Th>
                <Th>{laporan.jalankan ? "Diperbarui" : "Akan diperbarui"}</Th>
                <Th>Perlu dicek</Th>
                <Th>Catatan</Th>
              </Tr>
            </Thead>
            <tbody>
              {paketBerurusan.map((p) => (
                <Tr key={p.packageId}>
                  <Td>
                    <p className="font-medium text-slate-900">{p.nama}</p>
                    <p className="font-mono text-xs text-slate-500">{p.kodeSumber}</p>
                  </Td>
                  <Td className="font-semibold">{p.diperbarui}</Td>
                  <Td>{perluDicek(p)}</Td>
                  <Td className="text-xs text-slate-600">
                    {p.galatSumber && <p className="text-rose-600">Soal sumber tidak bisa dibaca: {p.galatSumber}</p>}
                    {p.diagramTidakValid > 0 && <p>{p.diagramTidakValid} diagram di sumber rusak (tidak disalin)</p>}
                    {p.tanpaFotoTersimpan > 0 && <p>{p.tanpaFotoTersimpan} soal belum punya foto tersimpan</p>}
                    {p.tidakBisaDicocokkan > 0 && <p>{p.tidakBisaDicocokkan} soal teksnya tidak cocok dengan sumber (mungkin sudah diedit)</p>}
                    {p.berubahSaatProses > 0 && <p>{p.berubahSaatProses} soal berubah selagi proses berjalan (ulangi)</p>}
                    {p.contoh.length > 0 && <p className="text-slate-500">Contoh: {p.contoh.join(" | ")}</p>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}

/**
 * Soal yang diimpor SEBELUM fitur dua gambar hanya tersimpan dengan fotonya, jadi siswa tidak bisa melihat Diagram Presisi
 * walaupun pratinjau admin dan soal.ayotka.id menampilkannya. Kartu ini menambahkan diagramnya dari sumber. Dua langkah:
 * periksa dulu (simulasi, tidak mengubah apa pun), baru terapkan.
 */
export function SinkronMediaCard() {
  const [laporan, setLaporan] = useState<LaporanSinkronMedia | null>(null);
  const [sibuk, setSibuk] = useState<"memeriksa" | "menerapkan" | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim(jalankan: boolean) {
    setSibuk(jalankan ? "menerapkan" : "memeriksa");
    setGalat(null);
    try {
      const res = await fetch("/api/admin-pusat/soal-import/sinkron-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jalankan }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.laporan) {
        setGalat(data?.error ?? "Gagal memeriksa gambar soal. Coba lagi sebentar lagi.");
        return;
      }
      setLaporan(data.laporan as LaporanSinkronMedia);
    } catch {
      setGalat("Tidak dapat terhubung ke server. Periksa koneksi internet.");
    } finally {
      setSibuk(null);
    }
  }

  const bisaTerapkan = laporan !== null && !laporan.jalankan && laporan.total.diperbarui > 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-sm font-semibold text-slate-900">Gambar soal yang sudah diimpor</h2>
          <p className="mt-1 text-sm text-slate-500">
            Soal yang diimpor sebelum fitur dua gambar hanya menyimpan fotonya, sehingga siswa tidak bisa melihat Diagram Presisi dan berpindah
            ke Foto Ilustrasi. Tombol ini menambahkan diagram dari soal.ayotka.id ke soal yang sumbernya punya foto <em>dan</em> diagram. Soal yang
            sudah dua gambar tidak diubah, jadi aman diulang. Impor baru sudah otomatis dua gambar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => kirim(false)} disabled={sibuk !== null}>
            {sibuk === "memeriksa" ? "Memeriksa..." : "Periksa dulu"}
          </Button>
          {bisaTerapkan && (
            <Button onClick={() => kirim(true)} disabled={sibuk !== null}>
              {sibuk === "menerapkan" ? "Menerapkan..." : `Terapkan ke ${laporan.total.diperbarui} soal`}
            </Button>
          )}
        </div>
      </div>

      {galat && (
        <Alert variant="danger" className="mt-3">
          {galat}
        </Alert>
      )}
      {laporan && <RingkasanSinkronMedia laporan={laporan} />}
    </Card>
  );
}
