/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        terminal: {
          bg: "#0a0e14",
          card: "#111820",
          border: "#1e2a3a",
          muted: "#5c6b7a",
        },
      },
      boxShadow: {
        glow: "0 0 24px rgba(239, 68, 68, 0.12)",
      },
    },
  },
  plugins: [],
};
