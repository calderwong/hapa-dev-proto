/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        astro: {
          dark: '#0B1221',
          surface: '#161E2E',
          border: '#2D3B55',
          primary: '#4FACFE',
          hover: '#3A8DDE',
          critical: '#FF3D3D',
          caution: '#FFC800',
          normal: '#00D68F',
          standby: '#2DCCFF',
          off: '#8B9BB4',
        }
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

