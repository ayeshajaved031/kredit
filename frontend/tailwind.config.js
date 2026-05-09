/** @type {import('tailwindcss').Config} */
// ==============================================================
// Tailwind config — Kredit Dark Infrastructure theme
// --------------------------------------------------------------
// Color tokens map directly to the design decisions locked with
// the user. Every brand color is exposed as both a Tailwind class
// (bg-bg, text-lime, border-divider) and a CSS variable (so we
// can reference them in inline styles, gradients, etc.).
// ==============================================================

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class", // dark-only app, but use class strategy so we always control it
  theme: {
    extend: {
      colors: {
        // ---- Surfaces ----
        bg: "#0F1115",            // deep charcoal — page background
        surface: "#171A21",       // secondary surfaces / cards
        "surface-2": "#1F232C",   // raised state, hover
        divider: "#2A2F3A",       // soft borders

        // ---- Text ----
        ink: "#F5F7FA",           // primary text
        "ink-muted": "#9BA3AF",   // muted/secondary text
        "ink-faint": "#6B7280",   // tertiary, hints

        // ---- Accents ----
        lime: {
          DEFAULT: "#C6FF3B",
          dark: "#A8E020",        // hover state
          glow: "rgba(198, 255, 59, 0.12)",
        },
        lavender: {
          DEFAULT: "#B197FC",
          dark: "#9B7BFA",
          glow: "rgba(177, 151, 252, 0.12)",
          ink: "#1A1133",         // dark ink for text on lavender bg
        },

        // ---- Semantic / status ----
        danger: "#B91C1C",
        "danger-soft": "rgba(185, 28, 28, 0.15)",
        warn: "#D97706",
        success: "#16A34A",
      },
      fontFamily: {
        sans: ['"Inter Tight Variable"', '"Inter Tight"', "Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', '"SF Mono"', "monospace"],
      },
      fontSize: {
        // Match the mockups exactly
        "display": ["38px", { lineHeight: "1.05", letterSpacing: "-1px" }],
        "h1": ["28px", { lineHeight: "1.15", letterSpacing: "-0.5px" }],
        "h2": ["22px", { lineHeight: "1.2", letterSpacing: "-0.3px" }],
        "h3": ["18px", { lineHeight: "1.3", letterSpacing: "-0.2px" }],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        // Used sparingly — only on dropdowns and the modal "card" itself
        "popover": "0 8px 24px rgba(0, 0, 0, 0.4)",
        "modal": "0 24px 48px rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 220ms ease-out",
        "spin-slow": "spin 1.2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: "translateY(8px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
