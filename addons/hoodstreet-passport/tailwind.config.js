/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Match MosAIc's host theme tokens from src/theme.css
        mosaic: {
          bg: '#0b1220',
          surface: '#0f172a',
          surfaceAlt: '#111827',
          border: '#1f2937',
          text: '#e6eef8',
          textMuted: '#94a3b8',
          primary: '#60a5fa',
          primaryStrong: '#3b82f6',
          accent: '#7c3aed',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          muted: '#475569',
        },
        // HoodStreet brand accent — only used for badge & active state
        hoodstreet: '#CCFF00',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};
