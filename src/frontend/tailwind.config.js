/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#edf5ff',
          100: '#d0e2ff',
          200: '#a6c8ff',
          300: '#78a9ff',
          400: '#4589ff',
          500: '#0f62fe', // IBM Carbon Blue 60
          600: '#0043ce',
          700: '#002d9c',
          800: '#001d6c',
          900: '#001141',
        },
        surface: {
          bg: 'var(--color-bg)',
          card: 'var(--color-card)',
          hover: 'var(--color-hover)',
          border: 'var(--color-border)',
        },
        content: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        }
      }
    },
  },
  plugins: [],
}
