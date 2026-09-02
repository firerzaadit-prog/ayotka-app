import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "AyoTKA - Tes Kemampuan Akademik untuk SD & SMP";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoData = await readFile(join(process.cwd(), "public/logo-mark.png"), "base64");
const logoSrc = `data:image/png;base64,${logoData}`;

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <img src={logoSrc} width={132} height={85} alt="AyoTKA" />
          <div style={{ display: "flex", fontSize: 104, fontWeight: 800, color: "#0f172a", letterSpacing: -3 }}>
            AyoTKA
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: "#475569" }}>
          Tes Kemampuan Akademik untuk SD &amp; SMP
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 44,
            width: 180,
            height: 8,
            borderRadius: 999,
            background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
