import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
        },
        hairline: "var(--border-subtle)",

        emerald: {
          DEFAULT: "var(--emerald)",
          dark: "var(--emerald-dark)",
          bright: "var(--emerald-bright)",
        },
        harvest: "var(--harvest)",
        amber: "var(--amber)",
        mandarin: "var(--mandarin)",

        ink: "var(--ink)",
        "ink-secondary": "var(--ink-secondary)",
        "ink-muted": "var(--ink-muted)",

        // Functional spoilage / risk tiers
        critical: { fg: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
        moderate: { fg: "#b45309", bg: "#fffbeb", border: "#fde68a" },
        optimal: { fg: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "var(--font-prompt)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "1.5rem",
      },
      maxWidth: {
        canvas: "1320px",
      },
      boxShadow: {
        float: "0 10px 25px -5px rgba(15,23,42,0.05), 0 8px 10px -6px rgba(15,23,42,0.03)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.85)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
