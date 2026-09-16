import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-poppins)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        card: ["var(--font-card-sans)", "system-ui", "sans-serif"],
        "card-serif": ["var(--font-card-serif)", "Georgia", "serif"],
        "card-mono": ["var(--font-card-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        card: {
          paper: "#F7F2E4",
          ink: "#1E2A52",
          seal: "#AD7A25",
        },
      },
    },
  },
  plugins: [],
};

export default config;
