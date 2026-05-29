import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          ...colors.zinc,
          700: '#282834',
          800: '#1E1E29',
          900: '#16161F',
          950: '#0A0A0F',
        },
        blue: {
          50: '#EAF6FF',
          100: '#D5EDFF',
          200: '#AEDCFF',
          300: '#7CC6FF',
          400: 'rgb(var(--accent) / <alpha-value>)',
          500: 'rgb(var(--accent) / <alpha-value>)',
          600: 'rgb(var(--accent-strong) / <alpha-value>)',
          700: '#0860B8',
          800: '#094E93',
          900: '#0C4274',
          950: '#082A4D',
        },
      },
      fontFamily: {
        sans: ['var(--font-ui-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
}
