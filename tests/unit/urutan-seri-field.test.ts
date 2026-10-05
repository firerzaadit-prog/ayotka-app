import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UrutanSeriField } from "@/components/soal/urutan-seri-field";

type Props = Parameters<typeof UrutanSeriField>[0];
const render = (p: Partial<Props>) =>
  renderToStaticMarkup(
    createElement(UrutanSeriField, {
      id: "urutan",
      nilai: "",
      onChange: () => undefined,
      wajib: true,
      galat: null,
      terpakai: [],
      berikutnya: null,
      memuat: false,
      ...p,
    }),
  );

describe("UrutanSeriField", () => {
  it("wajib: label bertanda *, atribut required, tanpa kata 'opsional'", () => {
    const html = render({});
    expect(html).toContain("Urutan dalam seri");
    expect(html).toContain("*");
    expect(html).toContain("required");
    expect(html).not.toContain("(opsional)");
    expect(html).not.toContain("Kosongkan supaya paket ini bebas");
  });

  it("tidak wajib: berlabel opsional dan menjelaskan akibat mengosongkan", () => {
    const html = render({ wajib: false });
    expect(html).toContain("(opsional)");
    expect(html).not.toContain("required");
    expect(html).toContain("Kosongkan supaya paket ini bebas dikerjakan kapan saja");
  });

  it("wajib tapi masih kosong: pengingat netral, BUKAN galat merah", () => {
    const html = render({ galat: "Urutan seri wajib diisi untuk Try Out Mandiri." });
    expect(html).toContain('data-testid="urutan-wajib"');
    expect(html).not.toContain('role="alert"');
  });

  it("urutan kembar: galat merah dengan role=alert dan input ditandai tidak valid", () => {
    const html = render({
      nilai: "2",
      galat: "Urutan 2 sudah dipakai paket lain di mata pelajaran ini. Pilih angka lain (urutan kosong berikutnya: 5).",
      terpakai: [1, 2, 4],
      berikutnya: 5,
    });
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-testid="galat-urutan"');
    expect(html).toContain("Urutan 2 sudah dipakai paket lain");
    expect(html).toContain('aria-invalid="true"');
  });

  it("menampilkan urutan terpakai, nomor berikutnya, dan tombol 'Pakai urutan N' bila isian berbeda", () => {
    const html = render({ nilai: "2", terpakai: [1, 2, 4], berikutnya: 5 });
    expect(html).toContain("Urutan yang sudah dipakai di mapel dan jenjang ini:");
    expect(html).toContain("<b>1, 2, 4</b>");
    expect(html).toContain("Satu urutan hanya boleh dipakai satu paket");
    expect(html).toContain("Pakai urutan 5");
  });

  it("tombol saran disembunyikan bila isian sudah sama dengan nomor berikutnya", () => {
    const html = render({ nilai: "5", terpakai: [1, 2, 4], berikutnya: 5 });
    expect(html).not.toContain("Pakai urutan 5");
  });

  it("sedang memuat: menunjukkan pemeriksaan sedang berjalan", () => {
    expect(render({ memuat: true })).toContain("Memeriksa urutan yang sudah terpakai");
  });

  it("menjelaskan bahwa tiap jenjang punya urutannya sendiri", () => {
    expect(render({})).toContain("Matematika");
    expect(render({})).toContain("SD urutan 1 dan Matematika SMP urutan 1 boleh sama");
  });

  it("menjelaskan aturan 06.00 WIB dan catatan jendela waktu", () => {
    const html = render({});
    expect(html).toContain("06:00 WIB");
    expect(html).toContain("Buka mulai menahan paket sampai waktunya");
  });
});
