/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand Colors
        brand: {
          blue: '#4991e5',
          cyan: '#39bdd6',
          teal: '#3bd4cb',
          dark: '#080b12',
          'gradient-start': 'rgb(0, 164, 189)',
          'gradient-end': 'rgb(0, 189, 165)',
        },
        // Primary Brand - Teal/Cyan gradient
        primary: {
          50: '#e6f9fb',
          100: '#ccf3f7',
          200: '#99e7ef',
          300: '#66dbe7',
          400: '#39bdd6', // Brand cyan
          500: '#00bda5', // Brand teal end
          600: '#00a4bd', // Brand teal start
          700: '#008a9f',
          800: '#006f81',
          900: '#005563',
          950: '#003a45',
        },
        // Accent - Blue
        accent: {
          50: '#e8f4fe',
          100: '#d1e9fd',
          200: '#a3d3fb',
          300: '#75bdf9',
          400: '#4991e5', // Brand blue
          500: '#3b7fd1',
          600: '#2f69bd',
          700: '#2353a9',
          800: '#1d4495',
          900: '#173581',
        },
        // UI Colors
        background: '#080b12', // brand dark
        foreground: '#ffffff',
        card: '#1a1a1a',
        muted: {
          DEFAULT: '#1e293b',
          foreground: '#94a3b8',
        },
        border: '#334155',
        // Semantic Colors (subtle and sophisticated)
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          300: '#86efac',
          500: '#10b981', // Emerald
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          300: '#fcd34d',
          500: '#f59e0b', // Amber
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          300: '#fda4af',
          500: '#f43f5e', // Rose
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          300: '#7dd3fc',
          500: '#0ea5e9', // Sky
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Matching design system
        'xs': ['0.75rem', { lineHeight: '1rem' }],       // 12px - tiny text
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px - small text
        'base': ['1rem', { lineHeight: '1.6' }],         // 16px - body text
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],    // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],       // 24px - section headers
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],  // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],    // 36px - page titles
        '5xl': ['3rem', { lineHeight: '1.2' }],          // 48px - hero
        '6xl': ['3.75rem', { lineHeight: '1.1' }],       // 60px
        '7xl': ['4.5rem', { lineHeight: '1' }],          // 72px - display
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(86deg, rgb(0, 164, 189) -3.28%, rgb(0, 189, 165) 97.8%)',
      },
      textWrap: {
        'balance': 'balance',
        'pretty': 'pretty',
      },
      boxShadow: {
        // Glassmorphism shadows
        'glass-sm': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'glass': '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'glass-lg': '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
        'glass-xl': '0 12px 32px rgba(0, 0, 0, 0.16), 0 6px 12px rgba(0, 0, 0, 0.1)',
        // Brand shadows - teal
        'brand': '0 4px 14px 0 rgba(0, 164, 189, 0.35)',
        'brand-lg': '0 10px 40px 0 rgba(0, 189, 165, 0.25)',
      },
      backdropBlur: {
        'xs': '2px',
        'glass-sm': '8px',
        'glass': '12px',
        'glass-lg': '16px',
        'glass-xl': '24px',
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '300': '300ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'blob': 'blob 7s infinite',
        'gradient-shift': 'gradientShift 3s ease infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        blob: {
          '0%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
          '33%': {
            transform: 'translate(30px, -50px) scale(1.1)',
          },
          '66%': {
            transform: 'translate(-20px, 20px) scale(0.9)',
          },
          '100%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
        },
        gradientShift: {
          '0%, 100%': {
            backgroundPosition: '0% 50%',
          },
          '50%': {
            backgroundPosition: '100% 50%',
          },
        },
      },
      zIndex: {
        '1': '1',
        '10': '10',
        '30': '30',
        '40': '40',
        '50': '50',
        '100': '100',
      },
    },
  },
  plugins: [],
}
