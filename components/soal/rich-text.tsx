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

  return (
    <span className={className}>
      {segments.map((segment, i) => {
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
        const html = renderKatexSafe(segment.value, segment.type === "block");
        return (
          <span
            key={i}
            className={segment.type === "block" ? "block" : undefined}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}

type Segment = { type: "text" | "inline" | "block"; value: string };

function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let rest = text;

  const pattern = /\$\$([^$]+)\$\$|\$([^$]+)\$/;

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
    } else {
      segments.push({ type: "inline", value: match[2]! });
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
