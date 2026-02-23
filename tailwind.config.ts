import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

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
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-links': '#f97316',
            'a': {
              textDecoration: 'none',
              fontWeight: '600',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            'h2': {
              borderBottom: '2px solid #fed7aa',
              paddingBottom: '0.5rem',
              marginTop: '2.5rem',
            },
            'h3': {
              color: '#1f2937',
            },
            'ul > li::marker': {
              color: '#f97316',
            },
            'ol > li::marker': {
              color: '#f97316',
            },
            'strong': {
              color: '#1f2937',
            },
            'blockquote': {
              borderLeftColor: '#f97316',
              fontStyle: 'normal',
              backgroundColor: '#fff7ed',
              padding: '1rem 1.5rem',
              borderRadius: '0 0.5rem 0.5rem 0',
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
