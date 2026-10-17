"use client";

import { Fragment, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Render teks soal/opsi/pembahasan yang bisa berisi rumus KaTeX (`$...$`
 * inline, `$$...$$` blok), format Markdown ringan (tebal/miring, heading,
 * bullet, tabel), tag alignment `[center]...[/center]`, gambar, dan penanda
 * (Benar)/(Salah). Disamakan dengan gaya render soal.ayotka.id (permintaan
 * user, 30 Sep 2026 - "patokannya di soal.ayotka.id") supaya soal yang
 * diimpor dari sana tampil identik di ayotka.id: paragraf otomatis terpisah
 * sebelum butir bernomor/label opsi, tabel & heading Markdown ikut dirender,
 * dan blok rumus/badge Benar-Salah punya bingkai yang sama.
 *
 * Arsitektur tetap berbasis pohon segmen React (bukan satu string HTML
 * mentah seperti versi soal.ayotka.id) - lebih aman karena hanya potongan
 * rumus KaTeX yang lewat dangerouslySetInnerHTML, bukan seluruh teks.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(applyReadabilityBreaks(text)), [text]);

  // Kasus paling umum (soal/opsi pendek tanpa heading/bullet/tabel, dan tanpa
  // pemisah paragraf baru) dirender INLINE tanpa pembungkus <p>/<div> - persis
  // perilaku lama, supaya tetap aman dipakai menyatu dengan teks lain (mis.
  // label opsi "A. <RichText .../>" dalam satu <span>). Konten yang benar-benar
  // berstruktur blok (paragraf ganda, heading, bullet, tabel) baru dibungkus
  // <div> dan boleh punya elemen blok (<p>, <table>, <ul>) di dalamnya.
  if (blocks.length === 1 && blocks[0]!.type === "paragraph") {
    return <span className={className}>{renderSegments(parseSegments(blocks[0]!.text))}</span>;
  }
  if (blocks.length === 0) {
    return <span className={className} />;
  }

  return <div className={className}>{blocks.map((block, i) => renderBlock(block, i))}</div>;
}

import {
  applyReadabilityBreaks,
  parseBlocks,
  type Block,
} from "@/lib/markdown/parse-blocks";

export { applyReadabilityBreaks, parseBlocks, type Block };

const HEADING_CLASS: Record<number, string> = {
  1: "text-base font-bold text-slate-900 mt-2 mb-1.5",
  2: "text-sm font-bold text-slate-900 mt-2 mb-1",
  3: "text-sm font-bold text-slate-800 mt-1.5 mb-1",
  4: "text-xs font-bold text-slate-800 mt-1 mb-0.5",
  5: "text-xs font-semibold text-slate-700 mt-0.5",
  6: "text-xs font-semibold text-slate-600 mt-0.5",
};

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case "paragraph":
      return (
        <p key={key} className="min-h-5 my-1.5 leading-relaxed">
          {renderSegments(parseSegments(block.text))}
        </p>
      );
    case "heading":
      return (
        <div key={key} className={HEADING_CLASS[block.level] ?? HEADING_CLASS[3]}>
          {renderSegments(parseSegments(block.text))}
        </div>
      );
    case "bullet":
      return (
        <ul key={key} className="my-1 flex flex-col gap-0.5">
          {block.items.map((item, i) => (
            <li key={i} className="ml-1 flex items-start gap-2">
              <span className="select-none text-slate-400">•</span>
              <span className="flex-1">{renderSegments(parseSegments(item))}</span>
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div key={key} className="my-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-left text-xs">
            {block.header.length > 0 && (
              <thead className="border-b border-slate-200 bg-slate-100/80 font-medium text-slate-700">
                <tr>
                  {block.header.map((cell, i) => (
                    <th key={i} className="px-3 py-2">
                      {renderSegments(parseSegments(cell))}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className={`border-b border-slate-100 last:border-b-0 ${ri % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-slate-600">
                      {renderSegments(parseSegments(cell))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "hr":
      return <hr key={key} className="my-3 border-slate-200" />;
  }
}

// ---------------------------------------------------------------------------
// Level inline: rumus KaTeX, gambar, alignment, tebal/miring, badge Benar/Salah.
// ---------------------------------------------------------------------------

function renderSegments(segments: Segment[]): React.ReactNode {
  return segments.map((segment, i) => {
    if (segment.type === "text") {
      // Pecah per baris lalu sisipkan <br /> di antara baris
      return (
        <Fragment key={i}>
          {segment.value.split("\n").map((line, j, arr) => (
            <Fragment key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </Fragment>
          ))}
        </Fragment>
      );
    }
    if (segment.type === "image") {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={segment.value}
          alt={segment.alt}
          className="my-2 mx-auto block max-h-72 max-w-full rounded-lg border border-slate-200 object-contain"
        />
      );
    }
    if (segment.type === "align") {
      return (
        <div key={i} style={{ textAlign: segment.align }} className="w-full">
          {renderSegments(segment.children)}
        </div>
      );
    }
    if (segment.type === "bold") {
      return <strong key={i} className="font-semibold">{renderSegments(segment.children)}</strong>;
    }
    if (segment.type === "italic") {
      return <em key={i} className="italic">{renderSegments(segment.children)}</em>;
    }
    if (segment.type === "badge") {
      const isBenar = segment.value === "benar";
      return (
        <span
          key={i}
          className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ${
            isBenar ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
          }`}
        >
          {isBenar ? "Benar" : "Salah"}
        </span>
      );
    }
    if (segment.type === "block" || segment.type === "inline") {
      const html = renderKatexSafe(segment.value, segment.type === "block");
      return segment.type === "block" ? (
        <div key={i} className="my-2.5 overflow-x-auto rounded border border-slate-200/60 bg-slate-50 px-2 py-1 text-center">
          <span dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      ) : (
        <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      );
    }
    return null;
  });
}

type Segment =
  | { type: "text" | "inline" | "block" | "image"; value: string; alt?: string }
  | { type: "align"; align: "left" | "center" | "right" | "justify"; children: Segment[] }
  | { type: "bold" | "italic"; children: Segment[] }
  | { type: "badge"; value: "benar" | "salah" };

export function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let rest = text;

  const pattern =
    /\$\$([^$]+)\$\$|\$([^$]+)\$|!\[([^\]]*)\]\(([^)]+)\)|\[(left|center|right|justify)\]([\s\S]*?)\[\/\5\]|\*\*([\s\S]*?)\*\*|\*([\s\S]*?)\*|\((benar|tepat)\)|\((salah|tidak tepat|keliru)\)/i;

  while (rest.length > 0) {
    const match = pattern.exec(rest);
    if (!match) {
      segments.push({ type: "text", value: rest });
      break;
    }
    if (match.index > 0) {
      segments.push({ type: "text", value: rest.slice(0, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "block", value: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: "inline", value: match[2] });
    } else if (match[4] !== undefined) {
      segments.push({ type: "image", value: match[4], alt: match[3] });
    } else if (match[5] !== undefined) {
      segments.push({
        type: "align",
        // Aman: grup regex ini cuma bisa cocok "left|center|right|justify" (lihat pattern di atas).
        align: match[5].toLowerCase() as "left" | "center" | "right" | "justify",
        children: parseSegments(match[6] ?? ""),
      });
    } else if (match[7] !== undefined) {
      segments.push({ type: "bold", children: parseSegments(match[7]) });
    } else if (match[8] !== undefined) {
      segments.push({ type: "italic", children: parseSegments(match[8]) });
    } else if (match[9] !== undefined) {
      segments.push({ type: "badge", value: "benar" });
    } else if (match[10] !== undefined) {
      segments.push({ type: "badge", value: "salah" });
    }
    rest = rest.slice(match.index + match[0].length);
  }

  return segments;
}

function renderKatexSafe(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false });
  } catch {
    return latex;
  }
}
