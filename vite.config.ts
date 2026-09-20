import { defineConfig } from 'vitest/config';
export default defineConfig({
  base: './',
  server: { watch: { usePolling: true } },
  // test/ holds the browser smoke suite, which node --test drives.
  test: { include: ['src/**/*.test.ts'] },
});
