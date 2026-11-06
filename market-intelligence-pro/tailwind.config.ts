import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#06101f",
          900: "#0a1a33",
          800: "#0f2547",
          700: "#16345f",
          600: "#1e467c",
          500: "#2a5b9c",
          400: "#4f7fbf",
          300: "#8aa9d6",
          100: "#e6edf7",
          50: "#f3f6fb",
        },
        ink: { 900: "#111827", 700: "#374151", 500: "#6b7280", 300: "#d1d5db", 200: "#e5e7eb", 100: "#f3f4f6" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      boxShadow: { card: "0 1px 2px rgba(10,26,51,0.06), 0 1px 3px rgba(10,26,51,0.08)" },
    },
  },
  plugins: [],
};
export default config;
