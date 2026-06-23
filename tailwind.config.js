export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: '#182863',
        'navy-deep': '#0E1B40',
        purple: '#3E2D71',
        magenta: { DEFAULT: '#C5117E', 50: '#FBE9F3', 100: '#F7CFE4', 200: '#EFA6CC', 300: '#E575B0', 400: '#D84296', 500: '#C5117E', 600: '#A50E69', 700: '#820B53', 800: '#600840', 900: '#40052B' },
        brand: { navy: '#182863', deep: '#0E1B40', purple: '#3E2D71', magenta: '#C5117E' }
      }
    }
  },
  plugins: []
};
