import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#101216", soft: "#2B2F36" },
        muted: "#6A707C",
        faint: "#9AA0AA",
        line: { DEFAULT: "#E6E8EC", strong: "#D4D7DD" },
        surface: { DEFAULT: "#F6F7F9", sunk: "#EEF0F3" },
        accent: {
          DEFAULT: "#1F5EEA",
          hover: "#1A50C8",
          soft: "#EAF0FD",
          line: "#C9D8FA",
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans Variable"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      fontSize: {
        "display": ["clamp(2.6rem, 5.4vw, 4.4rem)", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "title": ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
      },
      borderRadius: { xl2: "1.125rem" },
      boxShadow: {
        lift: "0 1px 2px rgba(16,18,22,0.04), 0 8px 24px -12px rgba(16,18,22,0.12)",
        ring: "0 0 0 4px rgba(31,94,234,0.14)",
      },
      transitionTimingFunction: {
        emphasized: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
