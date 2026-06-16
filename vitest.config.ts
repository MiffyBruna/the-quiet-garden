import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest config is kept separate from vite.config.ts so the Rundot libraries
// plugin (which expects the host environment) doesn't run during unit tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  esbuild: {
    target: 'es2022',
  },
});
