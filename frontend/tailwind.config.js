/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        tamil: ['"Noto Sans Tamil"', 'sans-serif'],
        sans:  ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Token-mapped brand scale
        brand: {
          100: '#E8E6F0',
          200: '#9590B8',
          300: '#5C5880',
          400: '#3D4170',
          500: '#2A2D4A',
          600: '#222647',
          700: '#1A1D35',
          800: '#111322',
          900: '#08090F',
          950: '#040508',
        },
        primary: '#7C6AF7',
        accent:  '#FFB800',
        noun:    '#3b82f6',
        verb:    '#f97316',
        adj:     '#22c55e',
        adv:     '#a855f7',
        success: {
          DEFAULT: '#39FF14',
          light:   '#7DFF5C',
          dark:    '#1AAD00',
        },
        danger: {
          DEFAULT: '#FF4757',
          light:   '#FF6B81',
        },
        heart:  '#FF4757',
        xp:     '#FFB800',
        streak: {
          DEFAULT: '#FFB800',
          light:   '#FFD54F',
        },
        neon: {
          cyan:    '#00F0FF',
          magenta: '#FF3CAC',
          green:   '#39FF14',
          yellow:  '#FFE600',
        },
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-4px)' },
          '40%': { transform: 'translateX(4px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        popIn: {
          '0%':   { transform: 'scale(0.6)', opacity: '0' },
          '60%':  { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scoreUp: {
          '0%':   { transform: 'translateY(0) scale(1)', opacity: '1' },
          '50%':  { transform: 'translateY(-20px) scale(1.3)' },
          '100%': { transform: 'translateY(-45px) scale(0.9)', opacity: '0' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        heartLost: {
          '0%':   { transform: 'scale(1)', filter: 'brightness(1)' },
          '25%':  { transform: 'scale(1.5)', filter: 'brightness(2)' },
          '50%':  { transform: 'scale(0.6)', filter: 'brightness(0.5)' },
          '100%': { transform: 'scale(1)', filter: 'brightness(1)' },
        },
        confettiFall: {
          '0%':   { transform: 'translateY(-20px) rotate(0deg)',   opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' },
        },
        starBounce: {
          '0%':   { transform: 'scale(0) rotate(-30deg)', opacity: '0' },
          '60%':  { transform: 'scale(1.4) rotate(5deg)', opacity: '1' },
          '80%':  { transform: 'scale(0.9) rotate(-2deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)',   opacity: '1' },
        },
      },
      animation: {
        shake:        'shake 0.4s ease-in-out',
        popIn:        'popIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        scoreUp:      'scoreUp 0.8s ease-out forwards',
        slideUp:      'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        fadeIn:       'fadeIn 0.2s ease-out',
        heartLost:    'heartLost 0.5s ease-out',
        confettiFall: 'confettiFall var(--duration, 2s) ease-in forwards',
        starBounce:   'starBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
      },
    },
  },
  plugins: [],
}
