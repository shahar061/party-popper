import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/__mocks__/setup.ts'],
  },
  resolve: {
    alias: {
      'cloudflare:workers': path.resolve(__dirname, 'src/__mocks__/cloudflare-workers.ts'),
    },
  },
});
