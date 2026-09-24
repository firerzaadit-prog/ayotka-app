"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { KirimUlangKonfirmasi } from "@/components/auth/kirim-ulang-konfirmasi";

export default function RegistrasiMitraPage() {
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [kontak, setKontak] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [emailPesan, setEmailPesan] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/registrasi/mitra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, email, password, kontak }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal mendaftar.");
      return;
    }
    setEmailPesan(data.emailTerkirim === false ? (data.pesan ?? "Email konfirmasi belum terkirim.") : null);
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          {emailPesan ? "Akunmu sudah dibuat" : "Cek email kamu"}
        </h1>
        {emailPesan ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{emailPesan}</p>
        ) : (
          <p className="text-sm text-slate-600">
            Kami sudah mengirim link verifikasi ke {email}. Klik link itu untuk mengaktifkan akun
            mitramu, lalu langsung bisa beli paket voucher secara online - tidak perlu menunggu
            persetujuan admin. Belum masuk? Cek juga folder spam.
          </p>
        )}
        <KirimUlangKonfirmasi email={email} />
        <Link
          href="/mitra/login"
          className="mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Menuju Halaman Login Mitra &rarr;
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Daftar - Mitra/Reseller</h1>
        <p className="text-sm text-slate-500">
          Beli voucher secara langsung dengan diskon grosir bertingkat, lalu bagikan kode akses ke siswamu.
        </p>
        <p className="mt-2 text-xs text-slate-600 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5">
          Sudah punya akun mitra?{" "}
          <Link href="/mitra/login" className="font-bold text-indigo-700 hover:underline">
            Masuk ke Portal Mitra di sini &rarr;
          </Link>
        </p>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <Label htmlFor="nama">Nama / nama usaha</Label>
        <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="kontak">Nomor WhatsApp (opsional)</Label>
        <Input id="kontak" value={kontak} onChange={(e) => setKontak(e.target.value)} />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Memproses..." : "Daftar sebagai Mitra"}
      </Button>

      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <p className="text-sm text-slate-600">
          Sudah punya akun mitra?{" "}
          <Link href="/mitra/login" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline">
            Masuk ke Portal Mitra
          </Link>
        </p>
        <Link href="/registrasi" className="text-xs text-slate-400 hover:text-slate-600">
          &larr; Kembali ke pilihan pendaftaran
        </Link>
      </div>
    </form>
  );
}
