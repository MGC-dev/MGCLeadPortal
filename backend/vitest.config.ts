import { defineConfig } from 'vitest/config';

// One test run for the whole backend. Each app and package is its own project.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
    passWithNoTests: true,
  },
});
