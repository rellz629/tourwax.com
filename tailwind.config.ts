import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

// Design tokens live in app/globals.css (:root). Tailwind reads them here so
// markup can use `text-ink`, `bg-paper`, `border-line`, `bg-wax`, etc.
//
// The `orange` and `red` entries below are a compatibility shim: inner pages
// still use `text-orange-500`, `bg-orange-50`, `from-orange-500 to-red-500`
// from the old gradient palette. Mapping those onto the wax tints/shades lands
// them on the new accent (and collapses the gradients to solid) without editing
// every file. Follow-up: rename those utilities to wax/ink and delete the shim.
const wax = {
  50: "#FBEBED",
  100: "#F6D3D7",
  200: "#EEA9B0",
  300: "#E57D88",
  400: "#DE5260",
  500: "#D62839",
  600: "#B31F2F",
  700: "#8F1825",
  800: "#6B121C",
  900: "#470C12",
};

export default {
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
        ink: "var(--ink)",
        page: "var(--page)",
        paper: "var(--paper)",
        line: "var(--line)",
        muted: "var(--muted)",
        wax: {
          DEFAULT: "var(--wax)",
          deep: "var(--wax-deep)",
          tint: "var(--wax-tint)",
        },
        label: "var(--label)",
        orange: wax,
        red: wax,
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "Helvetica Neue", "Arial", "sans-serif"],
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-links': 'var(--wax)',
            '--tw-prose-headings': 'var(--ink)',
            'a': {
              textDecoration: 'none',
              fontWeight: '600',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            'h2': {
              borderBottom: '2px solid var(--ink)',
              paddingBottom: '0.5rem',
              marginTop: '2.5rem',
            },
            'h3': {
              color: 'var(--ink)',
            },
            'ul > li::marker': {
              color: 'var(--ink)',
            },
            'ol > li::marker': {
              color: 'var(--ink)',
            },
            'strong': {
              color: 'var(--ink)',
            },
            'blockquote': {
              borderLeftColor: 'var(--wax)',
              fontStyle: 'normal',
              backgroundColor: 'var(--wax-tint)',
              padding: '1rem 1.5rem',
              borderRadius: '0 0.25rem 0.25rem 0',
            },
            'code': {
              backgroundColor: '#f3f4f6',
              padding: '0.2rem 0.4rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
          },
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config;
