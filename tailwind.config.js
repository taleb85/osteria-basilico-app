/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Verde bosco/salvia elegante — colore primario Osteria Basilico
        accent: {
          DEFAULT: '#2D5A27',
          hover:   '#264d21',
          dark:    '#1e3d1a',
          light:   '#d0dece',
          muted:   'rgba(45, 90, 39, 0.12)',
        },
        surface: {
          DEFAULT: '#f8fafc',
          card: '#ffffff',
        },
        ink: {
          DEFAULT: '#1a1a1a',
          secondary: '#475569',
          muted: '#64748b',
        },
      },
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1.25rem' }],
        body: ['0.875rem', { lineHeight: '1.375rem' }],
        lead: ['1rem', { lineHeight: '1.5rem' }],
        title: ['1.125rem', { lineHeight: '1.5rem' }],
        display: ['1.25rem', { lineHeight: '1.375rem' }],
      },
      animation: {
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        'admin-sync-bar': 'admin-sync-bar 1.15s ease-in-out infinite',
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'admin-sync-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(320%)' },
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"'],
        serif: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
