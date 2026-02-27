/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        primary: {
          50:  '#EAF3FF',
          100: '#C5DEFF',
          200: '#91C2FF',
          300: '#54A0FF',
          400: '#2181FF',
          500: '#0071E3',
          600: '#0062CC',
          700: '#0052AD',
          800: '#00408A',
          900: '#003070',
          950: '#001F50',
        },
      },
      borderRadius: {
        'sm':  '6px',
        'md':  '8px',
        'lg':  '10px',
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-md': '0 4px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'card-lg': '0 12px 40px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)',
        'modal':   '0 20px 60px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.06)',
        'sidebar': '1px 0 0 rgba(0,0,0,0.16)',
        'input':   '0 1px 2px rgba(0,0,0,0.04) inset',
      },
    },
  },
  plugins: [],
};
