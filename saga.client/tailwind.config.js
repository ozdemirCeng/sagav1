/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Apple Dark Mode Palette
        'base': '#000000',
        'deep': '#1c1c1e',
        'card': 'rgba(28, 28, 30, 0.65)',
        'input-bg': 'rgba(118, 118, 128, 0.24)',
        
        // Apple System Grays
        'gray': {
          'primary': '#FFFFFF',
          'secondary': '#8E8E93',
          'tertiary': '#48484A',
          'quaternary': '#3A3A3C',
        },
        
        // iOS Accent Colors
        'ios': {
          'blue': '#0A84FF',
          'purple': '#BF5AF2',
          'red': '#FF453A',
          'green': '#30D158',
          'orange': '#FF9F0A',
          'yellow': '#FFD60A',
          'teal': '#64D2FF',
          'pink': '#FF375F',
        }
      },
      fontFamily: {
        'inter': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        'sm': '8px',
        'md': '14px',
        'lg': '20px',
        'xl': '28px',
        '2xl': '32px',
      },
      backdropBlur: {
        'glass': '25px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.3)',
        'button': '0 4px 12px rgba(10, 132, 255, 0.3)',
        'poster': '0 8px 20px rgba(0, 0, 0, 0.5)',
        'large': '0 20px 60px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(10, 132, 255, 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(191, 90, 242, 0.4)' },
        },
      },
    },
  },
  plugins: [],
}
