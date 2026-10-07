"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Bot, Paperclip, Send, Sparkles, User, X } from "lucide-react";
import { RichText } from "@/components/soal/rich-text";
import { Alert } from "@/components/ui/alert";
import { GalatFoto, kompresGambar } from "@/components/tutor/kompres-gambar";
import { MAKS_PANJANG_PESAN, MAKS_PESAN_RIWAYAT } from "@/lib/tutor/konstanta";
import { potongRiwayat } from "@/lib/tutor/riwayat";

export type SoalChat = {
  questionId: string;
  nomor: number;
  format: string;
  /** Siswa menjawab sesuatu (minimal satu opsi / satu pernyataan). */
  adaJawaban: boolean;
  teks: string;
  options?: { id: string; label: string; teks: string; isCorrect: boolean }[];
  /** Jawaban siswa: label opsi yang dipilih (mis. "B" atau "A, C"); null bila kosong / bukan pilihan ganda. */
  jawabanLabel: string | null;
  benar: boolean;
  /** id opsi yang dipilih siswa (untuk menandai di ringkasan soal). */
  dipilihIds: string[];
};

type Pesan = { id: string; role: "user" | "assistant"; content: string; gambar?: string };

let hitungId = 0;
const idPesan = () => `p${++hitungId}`;

function sapaan(soal: SoalChat): string {
  if (soal.benar) return "Halo! Saya **Tutor AI AyoTKA**. Jawabanmu di soal ini sudah benar. Mau memperdalam konsepnya, atau mencoba cara penyelesaian lain?";
  if (soal.jawabanLabel) {
    return `Halo! Saya **Tutor AI AyoTKA**. Di soal ini kamu memilih **${soal.jawabanLabel}**. Mau kita telusuri bersama bagian mana yang membuatnya keliru? Kamu juga bisa kirim foto coretan caramu.`;
  }
  if (!soal.adaJawaban) {
    return "Halo! Saya **Tutor AI AyoTKA**. Soal ini belum kamu jawab. Mau mulai dari mana? Kamu juga bisa kirim foto coretan caramu.";
  }
  return "Halo! Saya **Tutor AI AyoTKA**. Di soal ini ada pernyataan yang kategorinya belum tepat. Mau kita telusuri satu per satu bersama? Kamu juga bisa kirim foto coretan caramu.";
}

function saranPertanyaan(soal: SoalChat): { label: string; prompt: string }[] {
  if (soal.benar) {
    return [
      { label: "Jelaskan konsepnya", prompt: "Jelaskan konsep di balik soal ini supaya aku benar-benar paham, bukan sekadar menghafal." },
      { label: "Cara yang lebih cepat?", prompt: "Apakah ada cara yang lebih cepat atau lebih efisien untuk mengerjakan soal seperti ini?" },
      { label: "Contoh serupa", prompt: "Bisa berikan contoh soal serupa dengan angka yang berbeda untuk latihan?" },
    ];
  }
  return [
    {
      label: "Di mana salahku?",
      prompt: soal.jawabanLabel
        ? `Aku menjawab ${soal.jawabanLabel}. Bisa jelaskan kenapa jawaban itu keliru tanpa langsung memberi kuncinya?`
        : !soal.adaJawaban
          ? "Aku belum menjawab soal ini. Bagaimana cara memulainya?"
          : "Pernyataan mana yang kategorinya keliru, dan kenapa? Jelaskan satu per satu tanpa langsung memberi semua kuncinya.",
    },
    { label: "Langkah demi langkah", prompt: "Tolong pandu aku mengerjakan soal ini dari langkah paling awal." },
    { label: "Rumus dan konsep", prompt: "Rumus atau konsep dasar apa yang dipakai untuk soal ini?" },
    { label: "Contoh serupa", prompt: "Bisa berikan contoh soal serupa dengan angka yang lebih sederhana?" },
  ];
}

/**
 * Drawer percakapan "Tanya Tutor AI" untuk satu soal di halaman pembahasan. Percakapan dan permintaan yang sedang
 * berjalan hidup di komponen ini, dan komponennya TETAP TERPASANG saat ditutup (hanya tidak digambar): menutup lalu
 * membuka lagi mengembalikan percakapan yang sama, dan balasan yang datang saat drawer tertutup masuk ke percakapan
 * yang benar. Konteks soal tidak dikirim dari sini: server menyusunnya dari database (lihat rute tutor).
 */
export function TutorAiChat({
  attemptId,
  judul,
  soal,
  buka,
  sisaHariIni,
  batasHarian,
  onSisaBerubah,
  onTutup,
}: {
  attemptId: string;
  judul: string;
  soal: SoalChat;
  buka: boolean;
  sisaHariIni: number;
  batasHarian: number;
  onSisaBerubah: (sisa: number) => void;
  onTutup: () => void;
}) {
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [input, setInput] = useState("");
  const [gambar, setGambar] = useState<{ uri: string; nama: string } | null>(null);
  const [menyiapkanFoto, setMenyiapkanFoto] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [lihatSoal, setLihatSoal] = useState(false);
  // Layanan Tutor kadang butuh puluhan detik: setelah beberapa saat menunggu, beri tahu bahwa sistem masih bekerja.
  const [menungguLama, setMenungguLama] = useState(false);
  const ujungRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const berkasRef = useRef<HTMLInputElement>(null);
  const idJudul = useId();

  const habis = sisaHariIni <= 0;

  // Esc menutup; halaman di belakang tidak ikut bergulir selama drawer terbuka; fokus ke kotak tulis saat dibuka.
  useEffect(() => {
    if (!buka) return;
    const lamaOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    document.addEventListener("keydown", saatTombol);
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = lamaOverflow;
      document.removeEventListener("keydown", saatTombol);
    };
  }, [buka, onTutup]);

  useEffect(() => {
    if (!memuat) return;
    const timer = setTimeout(() => setMenungguLama(true), 15_000);
    return () => {
      clearTimeout(timer);
      setMenungguLama(false);
    };
  }, [memuat]);

  useEffect(() => {
    if (buka) ujungRef.current?.scrollIntoView({ block: "end" });
  }, [buka, pesan, memuat, galat]);

  async function pilihFoto(file: File | undefined) {
    if (!file) return;
    setGalat(null);
    setMenyiapkanFoto(true);
    try {
      setGambar({ uri: await kompresGambar(file), nama: file.name });
    } catch (e) {
      setGalat(e instanceof GalatFoto ? e.message : "Foto tidak bisa diproses. Coba foto lain.");
    } finally {
      setMenyiapkanFoto(false);
    }
  }

  async function kirim(teksLangsung?: string) {
    if (memuat || habis || menyiapkanFoto) return;
    const teks = (teksLangsung ?? input).trim() || (gambar ? "Tolong periksa foto cara pengerjaanku ini." : "");
    if (!teks) return;

    const foto = gambar;
    const baru: Pesan = { id: idPesan(), role: "user", content: teks, gambar: foto?.uri };
    const gabungan = [...pesan, baru];
    setPesan(gabungan);
    setInput("");
    setGambar(null);
    setGalat(null);
    setMemuat(true);

    // Kegagalan apa pun: pesan siswa dikembalikan ke kotak tulis (dan fotonya ke lampiran) supaya bisa dikirim ulang,
    // dan riwayat tidak menyisakan pesan tanpa balasan.
    const batalkan = (pesanGalat: string) => {
      setPesan((prev) => prev.filter((p) => p.id !== baru.id));
      setInput(teksLangsung ?? teks);
      setGambar(foto);
      setGalat(pesanGalat);
    };

    try {
      const res = await fetch(`/api/siswa/attempts/${attemptId}/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: soal.questionId,
          messages: potongRiwayat(
            gabungan.map(({ role, content }) => ({ role, content })),
            MAKS_PESAN_RIWAYAT,
          ),
          gambar: foto?.uri,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && typeof data?.balasan === "string") {
        setPesan((prev) => [...prev, { id: idPesan(), role: "assistant", content: data.balasan }]);
        if (typeof data.sisaHariIni === "number") onSisaBerubah(data.sisaHariIni);
      } else {
        if (data?.code === "BATAS_HARIAN") onSisaBerubah(0);
        batalkan(data?.error ?? "Tutor AI belum bisa menjawab. Coba lagi sebentar lagi.");
      }
    } catch {
      batalkan("Koneksi bermasalah. Periksa internetmu lalu coba lagi.");
    } finally {
      setMemuat(false);
      // Kotak tulis dinonaktifkan selama menunggu sehingga fokusnya hilang; kembalikan agar siswa bisa langsung mengetik
      // (atau menekan Enter untuk mengirim ulang). Hanya bila belum ada elemen lain yang sengaja difokuskan.
      requestAnimationFrame(() => {
        if (!document.activeElement || document.activeElement === document.body) inputRef.current?.focus();
      });
    }
  }

  function saatKirim(e: FormEvent) {
    e.preventDefault();
    void kirim();
  }

  if (!buka || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/40" onMouseDown={(e) => e.target === e.currentTarget && onTutup()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl sm:rounded-l-3xl sm:border-l sm:border-slate-200"
      >
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white sm:rounded-tl-3xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <Sparkles className="h-5 w-5 text-yellow-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={idJudul} className="text-base font-bold">
                Tutor AI AyoTKA
              </h2>
              <p className="truncate text-xs font-medium text-blue-100">
                Soal {soal.nomor} · {judul}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold" title="Sisa pesan Tutor AI hari ini">
              Sisa {sisaHariIni}/{batasHarian}
            </span>
            <button type="button" onClick={onTutup} className="rounded-xl p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white" aria-label="Tutup Tutor AI">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-semibold text-slate-700">Soal {soal.nomor}</span>
            <button type="button" onClick={() => setLihatSoal((v) => !v)} className="shrink-0 font-semibold text-blue-600 hover:underline" aria-expanded={lihatSoal}>
              {lihatSoal ? "Sembunyikan soal" : "Lihat soal"}
            </button>
          </div>
          {lihatSoal && (
            <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-slate-800">
              <div className="text-xs leading-relaxed">
                <RichText text={soal.teks} />
              </div>
              {soal.options && soal.options.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {soal.options.map((o) => {
                    const dipilih = soal.dipilihIds.includes(o.id);
                    return (
                      <li
                        key={o.id}
                        className={`flex items-start gap-2 rounded-lg px-2 py-1 text-[11px] ${
                          o.isCorrect ? "bg-emerald-50 font-medium text-emerald-700" : dipilih ? "bg-rose-50 font-medium text-rose-600" : "text-slate-500"
                        }`}
                      >
                        <span className="shrink-0">{o.label}.</span>
                        <span className="flex-1">
                          <RichText text={o.teks} />
                        </span>
                        <span className="shrink-0">{o.isCorrect ? "Kunci" : dipilih ? "Jawabanmu" : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/40 p-4" aria-live="polite">
          <Gelembung peran="assistant">
            <RichText text={sapaan(soal)} />
          </Gelembung>
          {pesan.map((m) => (
            <Gelembung key={m.id} peran={m.role}>
              {m.gambar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.gambar} alt="Foto coretan yang kamu kirim" className="mb-2 max-h-48 max-w-full rounded-lg bg-white/10 object-contain" />
              )}
              {m.role === "user" ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : <RichText text={m.content} />}
            </Gelembung>
          ))}
          {memuat && (
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="flex h-8 w-8 shrink-0 animate-pulse items-center justify-center rounded-xl bg-blue-600 text-white">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-none border border-slate-200 bg-white px-3.5 py-2.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:0.4s]" />
                <span className="ml-2 font-medium text-slate-600">
                  {menungguLama ? "Masih menyiapkan jawaban, mohon tunggu sebentar lagi..." : "Tutor AI sedang menyiapkan jawaban..."}
                </span>
              </div>
            </div>
          )}
          {galat && <Alert variant="danger">{galat}</Alert>}
          {habis && !memuat && (
            <Alert variant="warning">Batas {batasHarian} pesan Tutor AI hari ini sudah tercapai. Kamu bisa bertanya lagi besok.</Alert>
          )}
          <div ref={ujungRef} />
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {saranPertanyaan(soal).map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={memuat || habis}
                onClick={() => void kirim(s.prompt)}
                className="whitespace-nowrap rounded-full border border-blue-200 bg-blue-50/60 px-3 py-1 font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {gambar && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/90 px-4 py-2">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gambar.uri} alt="Pratinjau foto" className="h-9 w-9 rounded-lg border border-slate-300 object-cover" />
              <div className="min-w-0 text-xs">
                <p className="max-w-[200px] truncate font-semibold text-slate-800">{gambar.nama}</p>
                <p className="text-[10px] text-slate-500">Siap dikirim ke Tutor AI</p>
              </div>
            </div>
            <button type="button" onClick={() => setGambar(null)} className="rounded-lg p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Batalkan foto">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="border-t border-slate-200 bg-white p-3.5">
          <form onSubmit={saatKirim} className="flex items-center gap-2">
            <input
              ref={berkasRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pilihFoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => berkasRef.current?.click()}
              disabled={memuat || habis || menyiapkanFoto}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
              title="Kirim foto coretan caramu"
              aria-label="Kirim foto coretan"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              maxLength={MAKS_PANJANG_PESAN}
              onChange={(e) => setInput(e.target.value)}
              placeholder={habis ? "Batas pesan hari ini tercapai" : gambar ? "Tulis pesan untuk foto ini (atau langsung kirim)" : "Tanyakan ke Tutor AI..."}
              disabled={memuat || habis}
              aria-label="Pesan untuk Tutor AI"
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={memuat || habis || menyiapkanFoto || (!input.trim() && !gambar)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40"
              aria-label="Kirim pesan"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
          <p className="mt-1.5 text-center text-[10px] text-slate-500">
            {menyiapkanFoto ? "Menyiapkan foto..." : "Tutor AI membantu memahami soal; jawabannya bisa keliru, jadi cocokkan dengan pembahasan."}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Gelembung({ peran, children }: { peran: "user" | "assistant"; children: React.ReactNode }) {
  const siswa = peran === "user";
  return (
    <div className={`flex gap-3 ${siswa ? "justify-end" : "justify-start"}`}>
      {!siswa && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          siswa ? "rounded-br-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white" : "rounded-bl-none border border-slate-200 bg-white text-slate-800"
        }`}
      >
        {children}
      </div>
      {siswa && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-100 text-blue-700">
          <User className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
