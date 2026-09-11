import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@crewforge/core': src('./packages/core/src/index.ts'),
      '@crewforge/runtime': src('./packages/runtime/src/index.ts'),
      '@crewforge/cli': src('./packages/cli/src/index.ts'),
    },
  },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    // No integration tests exist until Phase 4; avoid failing CI on an empty suite.
    passWithNoTests: true,
  },
});
