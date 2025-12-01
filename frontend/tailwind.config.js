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
        // Neon Glass Palette
        background: '#020617', // deep background
        cyan: {
          DEFAULT: '#0EA5E9',
          bright: '#22D3EE',
          neon: '#4ADEE7',
        },
        pink: {
          accent: '#FB37FF',
        },
        glass: {
          fill: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(148, 163, 184, 0.35)',
        },
        // Brand Colors (mapped to Neon Glass)
        brand: {
          dark: '#020617',
          cyan: '#0EA5E9',
          teal: '#22D3EE',
          neon: '#4ADEE7',
          accent: '#FB37FF',
        },
        // Keep existing semantic colors but potentially tweak them later if needed
        success: {
           50: '#f0fdf4',
           500: '#10b981',
           900: '#064e3b',
        },
        warning: {
           50: '#fffbeb',
           500: '#f59e0b',
           900: '#78350f',
        },
        error: {
           50: '#fef2f2',
           500: '#f43f5e',
           900: '#881337',
        },
        info: {
           50: '#f0f9ff',
           500: '#0ea5e9',
           900: '#0c4a6e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.05em' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.025em' }],
        'base': ['1rem', { lineHeight: '1.6', letterSpacing: '0.01em' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.2' }],
        '6xl': ['3.75rem', { lineHeight: '1.1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
      },
      borderRadius: {
        'none': '0',
        'sm': '0.25rem',
        'DEFAULT': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
        '2xl': '2rem',
        '3xl': '2.5rem', // Surfaces: rounded-3xl
        'full': '9999px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'neon-glow': 'radial-gradient(circle at center, rgba(34, 211, 238, 0.15) 0%, rgba(2, 6, 23, 0) 70%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.2)',
        'neon': '0 0 20px rgba(34, 211, 238, 0.3), 0 0 10px rgba(34, 211, 238, 0.1)',
        'neon-strong': '0 0 30px rgba(34, 211, 238, 0.5), 0 0 15px rgba(34, 211, 238, 0.3)',
        'glow-teal': '0 0 40px -10px rgba(34, 211, 238, 0.4)',
        'inner-light': 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px', // standard glass
        'xl': '16px',
        '2xl': '24px',
        '3xl': '40px',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
