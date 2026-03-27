/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        tamil: ['"Noto Sans Tamil"', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0f0ff',
          100: '#e0e0ff',
          200: '#c4c4ff',
          300: '#a0a0f8',
          400: '#7c7cf0',
          500: '#6060e8',
          600: '#4a4ad0',
          700: '#3838b8',
          800: '#2a2a90',
          900: '#1a1a2e',
          950: '#0f0f1a',
        },
        noun:  '#3b82f6',   // blue
        verb:  '#f97316',   // orange
        adj:   '#22c55e',   // green
        adv:   '#a855f7',   // purple
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-6px)' },
          '80%': { transform: 'translateX(6px)' },
        },
        popIn: {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '70%':  { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scoreUp: {
          '0%':   { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-40px)', opacity: '0' },
        },
      },
      animation: {
        shake:   'shake 0.4s ease-in-out',
        popIn:   'popIn 0.3s ease-out',
        scoreUp: 'scoreUp 0.8s ease-out forwards',
      },
    },
  },
  plugins: [],
}
