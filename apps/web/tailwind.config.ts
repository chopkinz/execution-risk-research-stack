import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          300: "#93c5fd",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af"
        }
      },
      backgroundColor: {
        meridian: "var(--meridian-bg-paper)",
        "meridian-default": "var(--meridian-bg-default)"
      },
      textColor: {
        meridian: "var(--meridian-text-primary)",
        "meridian-secondary": "var(--meridian-text-secondary)"
      },
      borderColor: {
        meridian: "var(--meridian-divider)"
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.08)"
      }
    }
  },
  plugins: []
};

export default config;
