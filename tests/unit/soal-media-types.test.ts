import { describe, expect, it } from "vitest";
import {
  parseQuestionMedia,
  formatQuestionMedia,
  mediaUntukExcel,
  urlGambarAman,
  type QuestionMediaData,
} from "@/lib/soal/media-types";

describe("parseQuestionMedia", () => {
  it("mengembalikan null jika input null, undefined, atau string kosong", () => {
    expect(parseQuestionMedia(null)).toBeNull();
    expect(parseQuestionMedia(undefined)).toBeNull();
    expect(parseQuestionMedia("")).toBeNull();
    expect(parseQuestionMedia("   ")).toBeNull();
  });

  it("mengembalikan objek single media jika input adalah URL biasa (backward compatible)", () => {
    const url = "https://cdn.example.com/images/soal-1.jpg";
    const result = parseQuestionMedia(url);
    expect(result).not.toBeNull();
    expect(result?.tipe).toBe("single");
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toEqual({
      tipe: "foto",
      label: "Foto Ilustrasi",
      url,
      alt: undefined,
    });
  });

  it("mengembalikan null jika JSON bukan format media yang valid", () => {
    expect(parseQuestionMedia('{"foo": "bar"}')).toBeNull();
    expect(parseQuestionMedia('{"items": []}')).toBeNull();
    expect(parseQuestionMedia("[1, 2, 3]")).toBeNull();
  });

  it("mem-parse JSON QuestionMediaData yang valid dengan diagram SVG dan foto", () => {
    const data: QuestionMediaData = {
      tipe: "multi",
      caption: "Dua bangun datar segiempat",
      items: [
        {
          tipe: "svg",
          label: "Diagram Presisi (SVG)",
          url: "https://storage.example.com/soal-svg/diagram.svg",
          svgContent: "<svg><path d='M0 0'/></svg>",
        },
        {
          tipe: "foto",
          label: "Foto Ilustrasi",
          url: "https://storage.example.com/soal-images/foto.jpg",
        },
      ],
    };

    const serialized = JSON.stringify(data);
    const parsed = parseQuestionMedia(serialized);

    expect(parsed).not.toBeNull();
    expect(parsed?.caption).toBe("Dua bangun datar segiempat");
    expect(parsed?.tipe).toBe("multi");
    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.items[0]?.tipe).toBe("svg");
    expect(parsed?.items[0]?.svgContent).toBe("<svg><path d='M0 0'/></svg>");
    expect(parsed?.items[1]?.tipe).toBe("foto");
  });
});

describe("formatQuestionMedia", () => {
  it("mengembalikan string JSON yang dapat di-parse kembali", () => {
    const data: QuestionMediaData = {
      tipe: "single",
      caption: "Penjelasan gambar",
      items: [
        {
          tipe: "foto",
          label: "Foto Ilustrasi",
          url: "https://example.com/img.png",
          alt: "Penjelasan gambar",
        },
      ],
    };

    const formatted = formatQuestionMedia(data);
    const roundtrip = parseQuestionMedia(formatted);
    expect(roundtrip).toEqual(data);
  });
});

describe("parseQuestionMedia: ketahanan terhadap data rusak atau berbahaya", () => {
  it("JSON yang diawali { tetapi tidak valid -> null (bukan dianggap alamat gambar)", () => {
    expect(parseQuestionMedia('{"items": [')).toBeNull();
    expect(parseQuestionMedia("{rusak")).toBeNull();
  });

  it("nilai bukan string/objek di dalam JSON tidak membuat galat; item tanpa sumber gambar dibuang", () => {
    const raw = JSON.stringify({
      items: [null, 5, "x", { tipe: "foto" }, { tipe: "foto", url: 123 }, { tipe: "foto", url: "https://x.test/ok.png" }],
    });
    const hasil = parseQuestionMedia(raw);
    expect(hasil?.items).toHaveLength(1);
    expect(hasil?.items[0]?.url).toBe("https://x.test/ok.png");
    expect(hasil?.tipe).toBe("single");
  });

  it("semua item tidak punya sumber gambar -> null", () => {
    expect(parseQuestionMedia(JSON.stringify({ items: [{ tipe: "svg" }, { tipe: "foto", url: "" }] }))).toBeNull();
  });

  it("skema berbahaya ditolak: javascript:, data:text/html, file:, protokol-relatif; item yang tersisa tetap dipakai", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "//evil.test/x.png", "/\\evil.test/x.png"]) {
      expect(parseQuestionMedia(JSON.stringify({ items: [{ tipe: "foto", url }] })), url).toBeNull();
      expect(parseQuestionMedia(url), url).toBeNull();
    }
    const campur = parseQuestionMedia(
      JSON.stringify({ items: [{ tipe: "foto", url: "javascript:alert(1)" }, { tipe: "foto", url: "https://x.test/a.png" }] }),
    );
    expect(campur?.items.map((i) => i.url)).toEqual(["https://x.test/a.png"]);
  });

  it("alamat klasik yang sah tetap diterima: http(s), jalur dari akar situs, data URI gambar (svg dikenali)", () => {
    expect(parseQuestionMedia("/media/soal-media/a.png")?.items[0]?.url).toBe("/media/soal-media/a.png");
    expect(parseQuestionMedia("HTTPS://X.test/A.PNG")?.items[0]?.tipe).toBe("foto");
    expect(parseQuestionMedia("data:image/png;base64,AAAA")?.items[0]?.tipe).toBe("foto");
    expect(parseQuestionMedia("data:image/svg+xml;utf8,%3Csvg%2F%3E")?.items[0]?.tipe).toBe("svg");
    expect(parseQuestionMedia("https://x.test/diagram.svg?v=2")?.items[0]?.tipe).toBe("svg");
  });

  it("satu item bertipe 'multi' di JSON dinormalkan menjadi single; label dan alt punya nilai bawaan", () => {
    const hasil = parseQuestionMedia(
      JSON.stringify({ tipe: "multi", caption: "Keterangan", items: [{ type: "diagram", svgContent: "<svg/>" }] }),
      "cadangan",
    );
    expect(hasil?.tipe).toBe("single");
    expect(hasil?.items[0]).toMatchObject({ tipe: "svg", label: "Diagram Presisi (SVG)", alt: "Keterangan", svgContent: "<svg/>" });
    expect(parseQuestionMedia(JSON.stringify({ items: [{ url: "https://x.test/a.png" }] }), "alt bawaan")?.caption).toBe("alt bawaan");
  });

  it("urlGambarAman", () => {
    expect(urlGambarAman(undefined)).toBeUndefined();
    expect(urlGambarAman("")).toBeUndefined();
    expect(urlGambarAman("https://a.test/x")).toBe("https://a.test/x");
    expect(urlGambarAman("ftp://a.test/x")).toBeUndefined();
    expect(urlGambarAman("data:image/gif;base64,R0lG")).toBe("data:image/gif;base64,R0lG");
    expect(urlGambarAman("data:application/pdf;base64,AA")).toBeUndefined();
  });
});

describe("mediaUntukExcel", () => {
  const ganda = formatQuestionMedia({
    tipe: "multi",
    caption: "Dua bangun",
    items: [
      { tipe: "svg", label: "Diagram Presisi (SVG)", url: "data:image/svg+xml;utf8,%3Csvg%2F%3E", svgContent: "<svg/>" },
      { tipe: "foto", label: "Foto Ilustrasi", url: "https://x.test/foto.png" },
    ],
  });

  it("tanpa media -> kosong; alamat biasa -> alamat itu sendiri (perilaku lama tidak berubah)", () => {
    expect(mediaUntukExcel(null)).toBe("");
    expect(mediaUntukExcel(undefined)).toBe("");
    expect(mediaUntukExcel("")).toBe("");
    expect(mediaUntukExcel("https://x.test/m.png")).toBe("https://x.test/m.png");
  });

  it("media ganda -> alamat foto http(s) pertama, bukan JSON", () => {
    expect(mediaUntukExcel(ganda)).toBe("https://x.test/foto.png");
  });

  it("media ganda tanpa foto http(s) (hanya diagram/data URI) atau JSON rusak -> kosong", () => {
    expect(mediaUntukExcel(JSON.stringify({ items: [{ tipe: "svg", svgContent: "<svg/>" }] }))).toBe("");
    expect(mediaUntukExcel("data:image/png;base64,AAAA")).toBe("");
    expect(mediaUntukExcel("{rusak")).toBe("");
  });
});
