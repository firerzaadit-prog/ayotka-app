"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export type StatusEmailKontakTampil = { alamat: string; terverifikasi: boolean } | null;

type Pesan = { jenis: "sukses" | "galat"; teks: string } | null;
type Mode = "lihat" | "ubah" | "lepas";

type Jawaban = {
  ok?: boolean;
  error?: string;
  pesan?: string;
  pengiriman?: boolean | null;
  emailKontak?: StatusEmailKontakTampil;
};

async function kirimAksi(isi: Record<string, unknown>): Promise<{ ok: boolean; data: Jawaban | null; galat: string | null }> {
  try {
    const res = await fetch("/api/siswa/profil/email-kontak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isi),
    });
    const data = (await res.json().catch(() => null)) as Jawaban | null;
    if (!res.ok) return { ok: false, data, galat: data?.error ?? "Permintaan gagal. Coba lagi." };
    return { ok: true, data, galat: null };
  } catch {
    return { ok: false, data: null, galat: "Koneksi bermasalah. Coba lagi." };
  }
}

/** Kalimat hasil setelah alamat dikirimi tautan verifikasi. */
function pesanPengiriman(alamat: string, pengiriman: boolean | null | undefined, pesan: string | undefined): string {
  if (pengiriman === true) {
    return `Email verifikasi sudah dikirim ke ${alamat}. Buka kotak masuk (atau folder spam), lalu tekan tombol verifikasi di dalamnya. Selama belum diverifikasi, alamat ini belum dipakai.`;
  }
  if (pengiriman === false) {
    return `Alamat ${alamat} tersimpan, tetapi email verifikasinya belum berhasil dikirim. Tekan "Kirim ulang verifikasi" beberapa saat lagi.`;
  }
  return pesan ?? "Tersimpan.";
}

/**
 * Email kontak untuk siswa yang masuk dengan NISN (lib/siswa/email-kontak.ts). Email loginnya sintetis, jadi tanpa email
 * kontak siswa tidak bisa menerima tautan lupa password maupun bukti pembayaran. Memasang atau melepas email kontak wajib
 * password saat ini; alamat baru baru dipakai setelah pemiliknya mengklik tautan verifikasi.
 */
export function KartuEmailKontak({
  nisn,
  status,
  onBerubah,
}: {
  nisn: string | null;
  status: StatusEmailKontakTampil;
  /** Dipanggil setelah server mengubah sesuatu, supaya halaman memuat ulang profil. */
  onBerubah: () => Promise<void>;
}) {
  const [modeDipilih, setMode] = useState<Mode>("lihat");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pesan, setPesan] = useState<Pesan>(null);
  const [sibuk, setSibuk] = useState(false);

  // Belum punya email kontak: langsung tampil formulir pemasangan.
  const mode: Mode = status ? modeDipilih : "ubah";

  function tutupForm() {
    setMode("lihat");
    setEmail("");
    setPassword("");
  }

  async function jalankan(isi: Record<string, unknown>, sesudah: (data: Jawaban) => string) {
    if (sibuk) return;
    setSibuk(true);
    setPesan(null);
    const hasil = await kirimAksi(isi);
    setSibuk(false);
    if (!hasil.ok) {
      setPesan({ jenis: "galat", teks: hasil.galat ?? "Gagal menyimpan." });
      return;
    }
    setPesan({ jenis: "sukses", teks: sesudah(hasil.data ?? {}) });
    tutupForm();
    await onBerubah();
  }

  function simpan(e: FormEvent) {
    e.preventDefault();
    const alamat = email.trim();
    void jalankan({ aksi: "simpan", email: alamat, password }, (d) =>
      pesanPengiriman(d.emailKontak?.alamat ?? alamat, d.pengiriman, d.pesan),
    );
  }

  function lepas(e: FormEvent) {
    e.preventDefault();
    void jalankan({ aksi: "hapus", password }, () => "Email kontak dilepas. Kamu bisa memasang email kontak lain kapan saja.");
  }

  function kirimUlang() {
    void jalankan({ aksi: "kirim_ulang" }, (d) => pesanPengiriman(status?.alamat ?? "", d.pengiriman, d.pesan));
  }

  return (
    <div className="flex flex-col gap-4" data-kartu-email-kontak>
      <Alert variant="info" data-info-masuk-nisn>
        Kamu masuk dengan <b>NISN{nisn ? ` ${nisn}` : ""}</b>, jadi tidak ada email login yang bisa diganti. Tambahkan{" "}
        <b>email kontak</b> (milikmu atau orang tuamu) supaya kamu bisa atur ulang password sendiri bila lupa dan menerima bukti
        pembayaran. Cara masukmu tidak berubah: tetap NISN dan password.
      </Alert>

      {pesan && (
        <Alert variant={pesan.jenis === "sukses" ? "success" : "danger"} role={pesan.jenis === "sukses" ? "status" : "alert"} data-pesan-email-kontak>
          {pesan.teks}
        </Alert>
      )}

      {status && (
        <div className="flex flex-wrap items-center gap-2" data-status-email-kontak>
          <span className="text-sm text-slate-600">Email kontak:</span>
          <span className="break-all text-sm font-semibold text-slate-900" data-alamat-email-kontak>
            {status.alamat}
          </span>
          {status.terverifikasi ? (
            <Badge variant="success">Terverifikasi</Badge>
          ) : (
            <Badge variant="warning">Menunggu verifikasi</Badge>
          )}
        </div>
      )}

      {status && !status.terverifikasi && mode === "lihat" && (
        <p className="text-xs text-slate-500">
          Cek kotak masuk (atau folder spam) alamat itu dan tekan tombol verifikasi di email dari AyoTKA. Belum terkirim? Kirim ulang di bawah.
        </p>
      )}

      {mode === "lihat" && status && (
        <div className="flex flex-wrap gap-2">
          {!status.terverifikasi && (
            <Button type="button" variant="secondary" disabled={sibuk} onClick={kirimUlang}>
              {sibuk ? "Mengirim..." : "Kirim ulang verifikasi"}
            </Button>
          )}
          <Button type="button" variant="secondary" disabled={sibuk} onClick={() => setMode("ubah")}>
            Ganti email kontak
          </Button>
          <Button type="button" variant="secondary" disabled={sibuk} onClick={() => setMode("lepas")}>
            Lepas
          </Button>
        </div>
      )}

      {mode === "ubah" && (
        <form onSubmit={simpan} className="flex flex-col gap-4" aria-label="Pasang email kontak">
          <div>
            <Label htmlFor="profil-email-kontak">{status ? "Email kontak baru" : "Email kontak"}</Label>
            <Input
              id="profil-email-kontak"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="nama@email.com"
            />
          </div>
          <div>
            <Label htmlFor="profil-email-kontak-password">Password saat ini</Label>
            <Input
              id="profil-email-kontak-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <p className="mt-1 text-xs text-slate-500">
              Demi keamanan, memasang email kontak butuh password. Kami mengirim tautan verifikasi ke alamat itu; alamat baru dipakai setelah kamu menekan tombol verifikasi di dalamnya.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={sibuk}>
              {sibuk ? "Memproses..." : status ? "Ganti & kirim verifikasi" : "Simpan & kirim verifikasi"}
            </Button>
            {status && (
              <Button type="button" variant="secondary" disabled={sibuk} onClick={tutupForm}>
                Batal
              </Button>
            )}
          </div>
        </form>
      )}

      {mode === "lepas" && (
        <form onSubmit={lepas} className="flex flex-col gap-4" aria-label="Lepas email kontak">
          <p className="text-sm text-slate-600">
            Setelah dilepas, kamu tidak bisa atur ulang password sendiri lewat NISN dan harus minta bantuan admin sekolah. Masukkan password untuk melepasnya.
          </p>
          <div>
            <Label htmlFor="profil-email-kontak-lepas-password">Password saat ini</Label>
            <Input
              id="profil-email-kontak-lepas-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" disabled={sibuk}>
              {sibuk ? "Memproses..." : "Lepas email kontak"}
            </Button>
            <Button type="button" variant="secondary" disabled={sibuk} onClick={tutupForm}>
              Batal
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
