import { defineConfig } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, acceptDownloads: true },
  // Builds the app and runs the real server against a throwaway data folder.
  webServer: {
    command: `rm -rf e2e/test-data && vite build && DATA_DIR=e2e/test-data PORT=${PORT} node server/index.js`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
