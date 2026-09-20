import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { watch: { usePolling: true } },
  // Vitest runs the simulation tests; the browser suite is Playwright's, in e2e/.
  test: { include: ['src/**/*.test.ts'] },
});
