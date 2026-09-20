import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { watch: { usePolling: true } },
  // Vitest runs the simulation tests only; the browser tests are Playwright's.
  test: { include: ['src/**/*.test.ts'] },
});
