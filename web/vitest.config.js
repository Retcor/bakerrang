import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/**/*.test.{js,jsx}', 'packages/**/*.test.{js,jsx}'],
    restoreMocks: true,
    clearMocks: true
  }
})
