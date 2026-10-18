import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './tests/testDatabase.js';

export default defineConfig({
  test: {
    globalSetup: './tests/globalSetup.js',
    // The app reads these when it starts inside the tests -> it talks to the TEST database.
    env: { DATABASE_URL: testDatabaseUrl(), NODE_ENV: 'test', AUTOMATION_INTERVAL_MINUTES: '0' },
    fileParallelism: false, // tests share one database, so run files one after another
    testTimeout: 20_000,
  },
});
