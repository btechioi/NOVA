import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@proj-nova/core-agent',
    include: ['src/**/*.test.ts'],
  },
})
