"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type SchoolOption = { id: string; nama: string; npsn: string | null };

export default function RegistrasiMandiriPage() {
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jenjang, setJenjang] = useState<"SD" | "SMP">("SD");
  const [tingkat, setTingkat] = useState("");

  const [sekolahQuery, setSekolahQuery] = useState("");
  const [sekolahHasil, setSekolahHasil] = useState<SchoolOption[]>([]);
  const [selectedSekolah, setSelectedSekolah] = useState<SchoolOption | null>(null);
  const [tidakAdaDiDaftar, setTidakAdaDiDaftar] = useState(false);
  const [asalSekolahManual, setAsalSekolahManual] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleCariSekolah(value: string) {
    setSekolahQuery(value);
    setSelectedSekolah(null);
    if (value.trim().length < 3) {
      setSekolahHasil([]);
      return;
    }
    const res = await fetch(`/api/registrasi/cari-sekolah?q=${encodeURIComponent(value)}`);
    const data = await res.json();
    if (res.ok) setSekolahHasil(data.schools ?? []);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/registrasi/mandiri", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama,
        email,
        password,
        jenjang,
        tingkat,
        asalSekolahId: !tidakAdaDiDaftar ? selectedSekolah?.id : "",
        asalSekolahManual: tidakAdaDiDaftar ? asalSekolahManual : "",
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Gagal mendaftar.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Cek email kamu</h1>
        <p className="text-sm text-slate-600">
          Kami sudah mengirim link verifikasi ke {email}. Klik link itu untuk mengaktifkan
          akunmu, lalu masuk ke AyoTKA.
        </p>
        <Link href="/login" className="text-sm text-slate-500 hover:text-slate-700">
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Daftar - Siswa Mandiri</h1>
        <p className="text-sm text-slate-500">1 paket gratis untuk coba, langganan bulanan setelahnya.</p>
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <Label htmlFor="nama">Nama lengkap</Label>
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="jenjang">Tingkat sekolah</Label>
          <select
            id="jenjang"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={jenjang}
            onChange={(e) => setJenjang(e.target.value as "SD" | "SMP")}
          >
            <option value="SD">SD</option>
            <option value="SMP">SMP</option>
          </select>
        </div>
        <div>
          <Label htmlFor="tingkat">Kelas</Label>
          <Input
            id="tingkat"
            type="number"
            min={jenjang === "SD" ? 4 : 7}
            max={jenjang === "SD" ? 6 : 9}
            required
            value={tingkat}
            onChange={(e) => setTingkat(e.target.value)}
          />
        </div>
      </div>

      {!tidakAdaDiDaftar ? (
        <div>
          <Label htmlFor="asalSekolah">Asal sekolah</Label>
          <Input id="asalSekolah" value={sekolahQuery} onChange={(e) => handleCariSekolah(e.target.value)} />
          {sekolahHasil.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 rounded-md border border-slate-200">
              {sekolahHasil.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSekolah(s);
                    setSekolahQuery(s.nama);
                    setSekolahHasil([]);
                  }}
                  className="px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  {s.nama}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setTidakAdaDiDaftar(true)}
            className="mt-1 text-xs text-slate-500 hover:text-slate-700"
          >
            Sekolahku tidak ada di daftar
          </button>
        </div>
      ) : (
        <div>
          <Label htmlFor="asalSekolahManual">Nama sekolah (ketik manual)</Label>
          <Input
            id="asalSekolahManual"
            required
            value={asalSekolahManual}
            onChange={(e) => setAsalSekolahManual(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Data sekolah ini akan diverifikasi tim kami sebelum dipakai untuk laporan resmi.
          </p>
          <button
            type="button"
            onClick={() => setTidakAdaDiDaftar(false)}
            className="mt-1 text-xs text-slate-500 hover:text-slate-700"
          >
            Cari dari daftar lagi
          </button>
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Memproses..." : "Daftar"}
      </Button>
      <Link href="/registrasi" className="text-center text-sm text-slate-500 hover:text-slate-700">
        Kembali
      </Link>
    </form>
  );
}
