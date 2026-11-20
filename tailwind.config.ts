/** @type {import('tailwindcss').Config} */
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // --- Colores (identidad visual Kinesia) ---
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
        // Fondo y superficie
        background: '#FAF9FC',
        white: '#FFFFFF',
        // Violetas de marca
        violet: {
          50: '#F3EFF8', // lavanda muy claro
          100: '#E8E1EF', // bordes
          200: '#D9C9EC', // lavanda
          300: '#A88BC9', // lila
          400: '#8568B2', // violeta secundario
          500: '#7051A6', // violeta principal
          600: '#49346D', // violeta profundo
        },
        // Textos
        ink: {
          main: '#302A38', // texto principal
          secondary: '#6E6479', // texto secundario
        },
        // Estados (solo badges/alertas, nunca marca)
        success: {
          bg: '#ECF0EE',
          text: '#3C5B4E',
        },
        warning: {
          bg: '#FBF3E6',
          text: '#8A662E',
        },
        error: {
          bg: '#F8ECEB',
          text: '#8C403D',
        },
      },
      // --- Tipografía ---
      fontFamily: {
        sans: ['"Public Sans"', 'sans-serif'],
        serif: ['"Fraunces"', 'serif'],
      },
      // --- Espaciado adicional ---
      spacing: {
        '3.5': '0.875rem',
        '15': '3.75rem',
      },
      // --- Bordes y sombras ---
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(110 102 121 / 0.06), 0 1px 1px -1px rgb(110 102 121 / 0.04)',
        md: '0 4px 6px -1px rgb(110 102 121 / 0.08), 0 2px 4px -2px rgb(110 102 121 / 0.04)',
      },
      // --- Animaciones utilitarias mínimas (solo entrada de página) ---
      animation: {
        'fade-in': 'fadeIn 220ms ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
