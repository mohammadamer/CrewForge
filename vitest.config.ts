import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    // Map workspace packages to their TS source so tests run against
    // uncompiled code without requiring a build step first.
    alias: {
      '@crewforge/core': src('./packages/core/src/index.ts'),
      '@crewforge/runtime': src('./packages/runtime/src/index.ts'),
      '@crewforge/integrations': src('./packages/integrations/src/index.ts'),
      '@crewforge/cli': src('./packages/cli/src/index.ts'),
      '@crewforge/vscode': src('./packages/vscode/src/index.ts'),
      vscode: src('./tests/mocks/vscode.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
