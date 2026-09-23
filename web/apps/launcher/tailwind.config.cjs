const preset = require('@bakerrang/web-tokens/tailwind-preset')

module.exports = {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    '../../packages/web-ui/src/**/*.{js,jsx}',
    '../../packages/web-app-shell/src/**/*.{js,jsx}'
  ]
}
