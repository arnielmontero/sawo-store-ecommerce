import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf2f2",
          100: "#fde3e3",
          500: "#e30613",
          600: "#c8050f",
          700: "#a8040d",
        },
        ink: {
          900: "#111111",
          700: "#2b2b2b",
          500: "#6b6b6b",
          300: "#a3a3a3",
          100: "#e5e5e5",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
