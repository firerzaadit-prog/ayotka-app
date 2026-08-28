"use client";

import { Fragment, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Render teks yang bisa mengandung rumus KaTeX: `$...$` untuk inline,
 * `$$...$$` untuk block. Sisanya dirender sebagai teks biasa dengan
 * newline (\n) dihormati sebagai <br /> supaya tampilan preview dan
 * tampilan siswa sama persis dengan yang diketik.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => parseSegments(text), [text]);

  return <span className={className}>{renderSegments(segments)}</span>;
}

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
          className="max-h-60 rounded-lg border border-slate-200 object-contain my-2 inline-block"
        />
      );
    }
    if (segment.type === "align") {
      return (
        <div key={i} style={{ textAlign: segment.align as any }} className="w-full">
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

    if (segment.type === "block" || segment.type === "inline") {
      const html = renderKatexSafe(segment.value, segment.type === "block");
      return (
        <span
          key={i}
          className={segment.type === "block" ? "block my-2" : undefined}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    return null;
  });
}

type Segment = 
  | { type: "text" | "inline" | "block" | "image"; value: string; alt?: string }
  | { type: "align"; align: string; children: Segment[] }
  | { type: "bold" | "italic"; children: Segment[] };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let rest = text;

  const pattern = /\$\$([^$]+)\$\$|\$([^$]+)\$|!\[([^\]]*)\]\(([^)]+)\)|\[(left|center|right|justify)\]([\s\S]*?)\[\/\5\]|\*\*([\s\S]*?)\*\*|\*([\s\S]*?)\*/i;

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
        align: match[5].toLowerCase(), 
        children: parseSegments(match[6] ?? "") 
      });
    } else if (match[7] !== undefined) {
      segments.push({
        type: "bold",
        children: parseSegments(match[7])
      });
    } else if (match[8] !== undefined) {
      segments.push({
        type: "italic",
        children: parseSegments(match[8])
      });
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
