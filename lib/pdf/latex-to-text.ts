/**
 * Tiket 5.8: teks soal/opsi/pembahasan bisa mengandung rumus KaTeX
 * (`$...$` inline, `$$...$$` block - lihat components/soal/rich-text.tsx,
 * dipakai di layar). pdfkit tidak bisa merender KaTeX sama sekali, jadi di
 * PDF dikonversi jadi notasi matematika teks-biasa yang tetap terbaca -
 * bukan typeset sempurna, tapi jangan sampai source LaTeX mentah
 * (`\div`, `\frac`, `\{`, `^\circ`, `$`) bocor apa adanya ke rapor yang diunduh.
 *
 * DUA MODE (opts.unicode):
 * - unicode: true  -> dipakai saat font Unicode (DejaVu Sans, lihat
 *   lib/pdf/fonts) berhasil dimuat. Pangkat/indeks jadi karakter
 *   superskrip/subskrip (x², L₁, 10⁻³), pecahan sederhana jadi karakter
 *   pecahan (⅓, ¹⁵⁄₈), dan simbol matematika asli (π, ≤, ≥, ≠, √, ∠, ✓).
 * - unicode: false -> cadangan kalau file font tidak ikut ter-bundle: hanya
 *   memakai karakter yang aman di font default PDF (WinAnsiEncoding: ² ³ ¹
 *   ° × ÷ ± · ½ ¼ ¾) - simbol di luar itu diganti padanan ASCII, karena
 *   di luar WinAnsi karakter tampil acak/rusak.
 */
export type LatexTextOptions = { unicode?: boolean };

type Ctx = { unicode: boolean };

// Penanda sementara supaya kurung kurawal/underscore LITERAL (\{ \} \_) tidak
// ikut terbuang/terbaca sebagai sintaks LaTeX oleh langkah berikutnya -
// dikembalikan jadi karakter aslinya di akhir tiap segmen rumus.
const LBRACE = "";
const RBRACE = "";
const UNDERSCORE = "";

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", f: "ᶠ", g: "ᵍ", h: "ʰ", i: "ⁱ", j: "ʲ", k: "ᵏ", l: "ˡ", m: "ᵐ",
  n: "ⁿ", o: "ᵒ", p: "ᵖ", r: "ʳ", s: "ˢ", t: "ᵗ", u: "ᵘ", v: "ᵛ", w: "ʷ", x: "ˣ", y: "ʸ", z: "ᶻ",
};

const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ",
  t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

/** Pangkat yang aman di font default PDF (WinAnsi) - cuma tiga ini. */
const SUP_WINANSI: Record<string, string> = { "1": "¹", "2": "²", "3": "³" };

const VULGAR_UNICODE: Record<string, string> = {
  "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾", "1/5": "⅕", "2/5": "⅖", "3/5": "⅗", "4/5": "⅘",
  "1/6": "⅙", "5/6": "⅚", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞",
};
const VULGAR_WINANSI: Record<string, string> = { "1/2": "½", "1/4": "¼", "3/4": "¾" };

/** perintah -> [padanan Unicode, padanan aman WinAnsi/ASCII] */
const SYMBOLS: Record<string, [string, string]> = {
  div: ["÷", "÷"], times: ["×", "×"], cdot: ["·", "·"], pm: ["±", "±"], mp: ["∓", "-+"],
  leq: ["≤", "<="], le: ["≤", "<="], geq: ["≥", ">="], ge: ["≥", ">="], neq: ["≠", "!="], ne: ["≠", "!="],
  approx: ["≈", "~="], equiv: ["≡", "=="], sim: ["∼", "~"], propto: ["∝", "~"], ll: ["≪", "<<"], gg: ["≫", ">>"],
  infty: ["∞", "tak hingga"], circ: ["°", "°"], degree: ["°", "°"], prime: ["′", "'"],
  angle: ["∠", "sudut "], triangle: ["△", "segitiga "], parallel: ["∥", "||"], perp: ["⊥", "_|_"],
  in: ["∈", " anggota "], notin: ["∉", " bukan anggota "], subset: ["⊂", " subset "], cup: ["∪", " U "], cap: ["∩", " irisan "],
  emptyset: ["∅", "{}"], varnothing: ["∅", "{}"], therefore: ["∴", "jadi"], because: ["∵", "karena"],
  to: ["→", "->"], rightarrow: ["→", "->"], leftarrow: ["←", "<-"], Rightarrow: ["⇒", "=>"], Leftrightarrow: ["⇔", "<=>"],
  leftrightarrow: ["↔", "<->"], implies: ["⇒", "=>"], iff: ["⇔", "<=>"],
  ldots: ["…", "..."], dots: ["…", "..."], cdots: ["…", "..."], bullet: ["•", "•"], neg: ["¬", "not "],
  land: ["∧", " dan "], lor: ["∨", " atau "], mid: ["|", "|"], checkmark: ["✓", "(v)"],
  pi: ["π", "pi"], alpha: ["α", "alpha"], beta: ["β", "beta"], gamma: ["γ", "gamma"], delta: ["δ", "delta"],
  Delta: ["Δ", "Delta"], theta: ["θ", "theta"], lambda: ["λ", "lambda"], mu: ["µ", "µ"], sigma: ["σ", "sigma"],
  Sigma: ["Σ", "Sigma"], omega: ["ω", "omega"], Omega: ["Ω", "Omega"], phi: ["φ", "phi"], rho: ["ρ", "rho"],
  lbrace: [LBRACE, LBRACE], rbrace: [RBRACE, RBRACE],
};

const FUNCTION_NAMES = new Set([
  "sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "lim", "max", "min", "exp", "arcsin", "arccos", "arctan",
]);

/** Pembungkus gaya (\text, \mathbf, ...) - isinya dipertahankan, dekorasinya dibuang. */
const WRAPPER_COMMANDS = new Set([
  "text", "textbf", "textit", "textrm", "textsf", "mathrm", "mathbf", "mathit", "mathsf", "mathcal", "mathbb",
  "operatorname", "mbox", "boldsymbol", "overline", "underline", "bar", "vec", "hat", "widehat", "tilde",
  "overrightarrow", "overleftrightarrow", "dot", "ddot", "cancel", "boxed",
]);

/** Perintah tanpa argumen yang cukup dilewati. */
const SKIP_COMMANDS = new Set([
  "displaystyle", "textstyle", "scriptstyle", "limits", "nolimits",
  "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "Biggl", "Biggr",
]);

const DOUBLESTRUCK: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ" };

/** Baca grup `{...}` seimbang mulai dari s[i] === "{". */
function readGroup(s: string, i: number): { content: string; next: number } {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const ch = s[j];
    if (ch === "\\") {
      j++; // lewati karakter yang di-escape (\{ \})
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { content: s.slice(i + 1, j), next: j + 1 };
    }
  }
  return { content: s.slice(i + 1), next: s.length }; // tidak seimbang: ambil sisanya
}

/**
 * Argumen sebuah perintah/operator: grup `{...}`, satu perintah `\circ`, atau
 * satu karakter. Spasi di depan dilewati (LaTeX mengabaikannya).
 */
function readArg(s: string, start: number): { content: string; next: number } {
  let i = start;
  while (i < s.length && s[i] === " ") i++;
  if (i >= s.length) return { content: "", next: i };
  if (s[i] === "{") return readGroup(s, i);
  if (s[i] === "\\") {
    const m = /^\\[a-zA-Z]+/.exec(s.slice(i));
    if (m) return { content: m[0], next: i + m[0].length };
    return { content: s.slice(i, i + 2), next: i + 2 };
  }
  return { content: s[i]!, next: i + 1 };
}

function mapAll(str: string, table: Record<string, string>): string | null {
  let out = "";
  for (const ch of str) {
    const m = table[ch];
    if (!m) return null;
    out += m;
  }
  return out;
}

function superscript(inner: string, ctx: Ctx): string {
  if (inner === "°" || inner === "′" || inner === "″") return inner;
  const mapped = mapAll(inner, ctx.unicode ? SUP : SUP_WINANSI);
  if (mapped !== null && inner.length > 0) return mapped;
  return `^${inner.length > 1 ? `(${inner})` : inner}`;
}

function subscript(inner: string, ctx: Ctx): string {
  if (ctx.unicode) {
    const mapped = mapAll(inner, SUB);
    if (mapped !== null && inner.length > 0) return mapped;
  }
  return `_${inner.length > 1 ? `(${inner})` : inner}`;
}

function isAtomic(t: string): boolean {
  return /^[\p{L}\p{N}.,°′]+$/u.test(t);
}

function wrapIfNeeded(t: string): string {
  return isAtomic(t) ? t : `(${t})`;
}

function fraction(a: string, b: string, ctx: Ctx): string {
  const num = a.trim();
  const den = b.trim();
  if (/^\d{1,3}$/.test(num) && /^\d{1,3}$/.test(den)) {
    const vulgar = (ctx.unicode ? VULGAR_UNICODE : VULGAR_WINANSI)[`${num}/${den}`];
    if (vulgar) return vulgar;
    if (ctx.unicode) {
      const sup = mapAll(num, SUP);
      const sub = mapAll(den, SUB);
      if (sup !== null && sub !== null) return `${sup}⁄${sub}`;
    }
  }
  return `${wrapIfNeeded(num)}/${wrapIfNeeded(den)}`;
}

function root(index: string | null, inner: string, ctx: Ctx): string {
  const body = wrapIfNeeded(inner.trim());
  if (!ctx.unicode) return index && index !== "2" ? `root${index}(${inner.trim()})` : `sqrt(${inner.trim()})`;
  if (index === "3") return `∛${body}`;
  if (index === "4") return `∜${body}`;
  if (index && index !== "2") return `${mapAll(index, SUP) ?? `^${index}`}√${body}`;
  return `√${body}`;
}

function convert(s: string, ctx: Ctx): string {
  let out = "";
  let i = 0;

  while (i < s.length) {
    const ch = s[i]!;

    if (ch === "\\") {
      const next = s[i + 1];
      if (next === undefined) {
        i++;
        continue;
      }
      if ("{}%$&#_".includes(next)) {
        out += next === "{" ? LBRACE : next === "}" ? RBRACE : next === "_" ? UNDERSCORE : next;
        i += 2;
        continue;
      }
      if (next === "\\") {
        out += " "; // baris baru di dalam cases/matriks
        i += 2;
        continue;
      }
      if (",;:! ".includes(next)) {
        out += " ";
        i += 2;
        continue;
      }
      const m = /^[a-zA-Z]+/.exec(s.slice(i + 1));
      if (!m) {
        i += 2; // "\X" tak dikenal - buang
        continue;
      }
      const cmd = m[0];
      i += 1 + cmd.length;

      if (cmd === "frac" || cmd === "dfrac" || cmd === "tfrac") {
        const a = readArg(s, i);
        const b = readArg(s, a.next);
        out += fraction(convert(a.content, ctx), convert(b.content, ctx), ctx);
        i = b.next;
      } else if (cmd === "sqrt") {
        let index: string | null = null;
        if (s[i] === "[") {
          const end = s.indexOf("]", i);
          if (end > i) {
            index = s.slice(i + 1, end).trim();
            i = end + 1;
          }
        }
        const arg = readArg(s, i);
        out += root(index, convert(arg.content, ctx), ctx);
        i = arg.next;
      } else if (cmd === "left" || cmd === "right") {
        if (s[i] === ".") i++; // \left. / \right. = pembatas tak terlihat
      } else if (cmd === "begin" || cmd === "end") {
        i = readArg(s, i).next; // nama environment (cases, matrix, ...) dibuang
      } else if (cmd === "quad" || cmd === "qquad") {
        out += " ";
      } else if (SKIP_COMMANDS.has(cmd)) {
        // tidak menghasilkan apa-apa
      } else if (cmd === "mathbb") {
        const arg = readArg(s, i);
        out += ctx.unicode ? (DOUBLESTRUCK[arg.content.trim()] ?? convert(arg.content, ctx)) : convert(arg.content, ctx);
        i = arg.next;
      } else if (WRAPPER_COMMANDS.has(cmd)) {
        const arg = readArg(s, i);
        out += convert(arg.content, ctx);
        i = arg.next;
      } else if (FUNCTION_NAMES.has(cmd)) {
        out += cmd;
      } else if (SYMBOLS[cmd]) {
        out += SYMBOLS[cmd]![ctx.unicode ? 0 : 1];
      } else if (s[i] === "{") {
        // perintah tak dikenal yang membungkus grup: pertahankan isinya, buang perintahnya
        const arg = readGroup(s, i);
        out += convert(arg.content, ctx);
        i = arg.next;
      }
      continue;
    }

    if (ch === "^" || ch === "_") {
      const arg = readArg(s, i + 1);
      const inner = convert(arg.content, ctx);
      out += ch === "^" ? superscript(inner, ctx) : subscript(inner, ctx);
      i = arg.next;
      continue;
    }

    if (ch === "{" || ch === "}") {
      i++; // grup LaTeX polos - cuma pengelompokan, bukan teks
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

function latexInnerToText(latex: string, ctx: Ctx): string {
  return convert(latex, ctx)
    .replaceAll(LBRACE, "{")
    .replaceAll(RBRACE, "}")
    .replaceAll(UNDERSCORE, "_")
    .trim();
}

export function latexToPlainText(text: string, opts: LatexTextOptions = {}): string {
  const ctx: Ctx = { unicode: opts.unicode ?? false };
  return (
    text
      .replace(/\$\$([^$]+)\$\$/g, (_, inner: string) => latexInnerToText(inner, ctx))
      .replace(/\$([^$]+)\$/g, (_, inner: string) => latexInnerToText(inner, ctx))
      // Markup lain yang dikenal RichText (components/soal/rich-text.tsx,
      // dipakai di layar siswa) tapi tidak dimengerti pdfkit sama sekali -
      // dilucuti jadi teks polos (isinya dipertahankan), bukan dibiarkan
      // bocor mentah seperti "[center]...[/center]" atau "**tebal**" ke rapor.
      // (Perataan [center] sendiri ditangani renderer sebelum teks dipecah di
      // gambar - lihat renderTextWithImages; ini jaring pengaman untuk tag
      // yang masih tersisa, termasuk tag tunggal tanpa pasangan.)
      .replace(/\[(left|center|right|justify)\]([\s\S]*?)\[\/\1\]/gi, "$2")
      .replace(/\[\/?(left|center|right|justify)\]/gi, "")
      .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
      // Hanya tag HTML sungguhan (<b>, </p>, <br/>) - jangan menelan tanda
      // "<" ">" matematika biasa seperti "3 < x > 2".
      .replace(/<\/?[a-zA-Z][^>]*>/g, "")
      // spasi ganda sering muncul setelah \text{ ... } dilepas (mis. "$X
      // \text{ m}$" - ada spasi di dua sisi) - dirapikan jadi satu spasi.
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}
