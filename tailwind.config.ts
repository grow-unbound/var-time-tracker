import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#1B3A5C",
          light: "#2A5480",
        },
        accent: {
          DEFAULT: "#E8A020",
          light: "#FDF3E0",
        },
        success: {
          DEFAULT: "#1A6B45",
          light: "#E8F5EE",
        },
        danger: {
          DEFAULT: "#C0392B",
          light: "#FDECEA",
        },
        surface: "#FFFFFF",
        appbg: "#F4F6F9",
        sidebar: "#C8D8EA",
        border: "#E2E8F0",
        text: {
          primary: "#1A1A2E",
          secondary: "#5A6478",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        card: "10px",
        input: "8px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06)",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-4px)" },
          "40%": { transform: "translateX(4px)" },
          "60%": { transform: "translateX(-3px)" },
          "80%": { transform: "translateX(3px)" },
        },
        rowEnter: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        toastIn: {
          from: { opacity: "0", transform: "translateX(100%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        shake: "shake 300ms ease",
        "row-enter": "rowEnter 200ms ease",
        "toast-in": "toastIn 200ms ease",
      },
    },
  },
  plugins: [],
};
export default config;
