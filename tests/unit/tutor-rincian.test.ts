import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RincianJawaban, type PerSoal, type TutorProps } from "@/components/hasil/rincian-jawaban";

const perSoal: PerSoal[] = [
  {
    questionId: "q-1",
    format: "pg",
    teks: "Soal satu",
    skor: 1,
    skorMaks: 1,
    jawabanJson: { option_id: "o2" },
    pembahasan: "Pembahasan satu",
    options: [
      { id: "o1", label: "A", teks: "Empat", isCorrect: false },
      { id: "o2", label: "B", teks: "Lima", isCorrect: true },
    ],
  },
  {
    questionId: "q-2",
    format: "pg",
    teks: "Soal dua",
    skor: 0,
    skorMaks: 1,
    jawabanJson: {},
    pembahasan: null,
    options: [
      { id: "p1", label: "A", teks: "Satu", isCorrect: true },
      { id: "p2", label: "B", teks: "Dua", isCorrect: false },
    ],
  },
];

const tutor = (o: Partial<TutorProps> = {}): TutorProps => ({
  attemptId: "att-1",
  judul: "Try Out Matematika",
  aktif: true,
  sisaHariIni: 20,
  batasHarian: 20,
  hariSimpan: 7,
  soalBerriwayat: [],
  onSisaBerubah: () => {},
  ...o,
});
const render = (t?: TutorProps) => renderToStaticMarkup(createElement(RincianJawaban, { perSoal, tutor: t }));

const hitung = (html: string, kata: string) => html.split(kata).length - 1;

describe("RincianJawaban - tombol Tanya Tutor AI", () => {
  it("Tutor aktif: satu tombol per soal, dengan id yang menunjuk soalnya", () => {
    const html = render(tutor());
    expect(hitung(html, "Tanya Tutor AI")).toBe(2);
    expect(html).toContain('id="tutor-tombol-q-1"');
    expect(html).toContain('id="tutor-tombol-q-2"');
  });

  it("Tutor tidak aktif: tidak ada tombol sama sekali", () => {
    expect(render(tutor({ aktif: false }))).not.toContain("Tanya Tutor AI");
  });

  it("tanpa properti tutor (halaman admin): tidak ada tombol dan tampilan lama utuh", () => {
    const html = render(undefined);
    expect(html).not.toContain("Tanya Tutor AI");
    expect(html).toContain("Soal satu");
    expect(html).toContain("Pembahasan satu");
  });

  it("pembahasan dan kunci SELALU tampil langsung (tidak ada gerbang 'menunggu jendela ujian ditutup'), bersama tombol Tutor", () => {
    const html = render(tutor());
    expect(html).toContain("Pembahasan satu");
    expect(html).toContain("✓ Kunci");
    expect(html).not.toMatch(/jendela ujian kelasnya ditutup|akan tersedia setelah/);
    expect(hitung(html, "Tanya Tutor AI")).toBe(2);
  });

  it("soal yang punya percakapan tersimpan: tombolnya berlabel 'Lanjutkan chat Tutor AI', soal lain tetap 'Tanya Tutor AI'", () => {
    const html = render(tutor({ soalBerriwayat: ["q-1"] }));
    expect(hitung(html, "Lanjutkan chat Tutor AI")).toBe(1);
    expect(hitung(html, "Tanya Tutor AI")).toBe(1);
    expect(html.indexOf("Lanjutkan chat Tutor AI")).toBeLessThan(html.indexOf("Tanya Tutor AI"));
  });

  it("tanpa riwayat tersimpan: semua tombol 'Tanya Tutor AI', tidak ada 'Lanjutkan'", () => {
    const html = render(tutor({ soalBerriwayat: [] }));
    expect(hitung(html, "Tanya Tutor AI")).toBe(2);
    expect(html).not.toContain("Lanjutkan chat");
  });

  it("riwayat untuk soal yang tidak ada di halaman ini diabaikan", () => {
    const html = render(tutor({ soalBerriwayat: ["soal-lain"] }));
    expect(hitung(html, "Tanya Tutor AI")).toBe(2);
    expect(html).not.toContain("Lanjutkan chat");
  });

  it("drawer tidak digambar sebelum ada yang membukanya (tidak ada dialog di halaman)", () => {
    expect(render(tutor())).not.toContain('role="dialog"');
  });

  it("tombol bisa dijangkau papan ketik dan bukan pengirim formulir", () => {
    const html = render(tutor());
    expect(html).toMatch(/<button type="button" id="tutor-tombol-q-1"/);
  });
});
