const withMT = require('@material-tailwind/react/utils/withMT')
const colors = require('tailwindcss/colors')

module.exports = withMT({
  content: ['./src/**/*.{js,jsx}'],
  mode: 'jit',
  theme: {
    extend: {
      colors: {
        ...colors,
        // Gold "BR" logo palette. Use bg-brand / text-brand in new markup
        // instead of hardcoding hex. Mirrors the CSS vars in index.css.
        brand: {
          DEFAULT: '#FFD500',
          hover: '#F0C400',
          deep: '#9A6B00',
          ink: '#1f2937'
        }
      }
    }
  },
  plugins: []
})
