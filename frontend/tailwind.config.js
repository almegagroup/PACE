/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],

  theme: {
    extend: {
      /* =========================
         ERP COLOR TOKENS (LOCKED)
         ========================= */

      colors: {
        /* Core surfaces */
        bg: {
          base: "#070707",        // app background
          raised: "#0f0f0f",      // cards, modals
          sunken: "#1a1a1a",      // inputs, bars
        },

        /* Bronze brand system */
        bronze: {
          50:  "#fdf6ec",
          100: "#f7e4c8",
          200: "#edc890",
          300: "#e2ab58",
          400: "#d08c3a",   // PRIMARY
          500: "#b87333",
          600: "#945826",
          700: "#6f401b",
        },

        /* Text system */
        text: {
          primary: "#e6e6e6",
          secondary: "#b5b5b5",
          muted: "#8a8a8a",
          danger: "#ff6b6b",
          success: "#4ade80",
        },

        /* Borders & dividers */
        border: {
          subtle: "rgba(208,140,58,0.25)",
          strong: "rgba(208,140,58,0.55)",
        },
      },

      /* =========================
         TYPOGRAPHY TOKENS
         ========================= */

      fontFamily: {
        ui: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },

      letterSpacing: {
        brand: "0.32em",
        section: "0.18em",
        mono: "0.12em",
      },

      /* =========================
         MOTION TOKENS (future-safe)
         ========================= */

      transitionDuration: {
        fast: "120ms",
        normal: "220ms",
        slow: "420ms",
      },

      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0.0, 0.2, 1)",
      },

      /* =========================
         SHADOWS (ERP STYLE)
         ========================= */

      boxShadow: {
        glow: "0 0 18px rgba(208,140,58,0.25)",
        focus: "0 0 0 2px rgba(208,140,58,0.6)",
      },
    },
  },

  plugins: [],
};
