import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(here, '.') } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
