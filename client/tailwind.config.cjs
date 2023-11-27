const withMT = require('@material-tailwind/react/utils/withMT')
const colors = require('tailwindcss/colors')

module.exports = withMT({
  content: ['./src/**/*.{js,jsx}'],
  mode: 'jit',
  theme: {
    extend: {
      colors: {
        ...colors
      }
    }
  },
  plugins: []
})
