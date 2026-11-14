import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "space-black": "#000000",
        "space-void": "#05070B",
        "flame-orange": "#FF6B00",
        "flame-amber": "#FFB020",
        "flame-ember": "#FF3300",
        "caution-amber": "#FFB020",
        "critical-rose": "#FF4D6D",
        "glass-surface": "rgba(255, 255, 255, 0.05)",
        "glass-border": "rgba(255, 255, 255, 0.10)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        "orange-glow": "0 0 24px rgba(255, 107, 0, 0.28), 0 0 64px rgba(255, 107, 0, 0.12)",
        "orange-ring": "0 0 0 1px rgba(255, 107, 0, 0.50), 0 0 22px rgba(255, 107, 0, 0.25)",
      },
      backdropBlur: {
        glass: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
