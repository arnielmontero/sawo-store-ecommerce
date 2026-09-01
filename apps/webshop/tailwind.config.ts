import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm cedar/amber palette — the storefront's primary accent,
        // distinct from the admin app's red `brand` scale so the two never
        // get visually confused.
        cedar: {
          50: "#fbf4ee",
          100: "#f3e2d0",
          200: "#e6c49f",
          300: "#d6a06a",
          400: "#c17f42",
          500: "#a8632d",
          600: "#8a4d24",
          700: "#6d3c1f",
          800: "#54301c",
          900: "#3d2417",
        },
        cream: {
          50: "#fefcf9",
          100: "#faf5ec",
          200: "#f3e9d7",
        },
        ink: {
          900: "#231b14",
          700: "#4a3d31",
          500: "#7a6b5c",
          300: "#b3a595",
          100: "#e9e1d6",
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
        serif: ["'Fraunces'", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 2px 10px rgba(61, 36, 23, 0.08)",
        cardHover: "0 10px 30px rgba(61, 36, 23, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
