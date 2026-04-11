import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10000,
    setupFiles: ['./src/__tests__/helpers/setup.ts'],
    fileParallelism: false,
  },
});
