import { defineConfig } from 'vitest/config';

// Dev server serves the repo root, so demo pages live at /demo/*.html and
// pet assets at /pets/<id>/. Library build config arrives in Milestone 7.
export default defineConfig({
  server: { port: 5199, strictPort: true },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
