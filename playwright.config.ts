import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const databaseURL = "file:/tmp/wagaku-playwright.db";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: [
      `rm -f ${databaseURL.replace("file:", "")}`,
      `DATABASE_URL=${databaseURL} npx prisma migrate deploy`,
      `DATABASE_URL=${databaseURL} npm run db:seed`,
      `DATABASE_URL=${databaseURL} npm run db:backfill-vocabulary-keys`,
      `DATABASE_URL=${databaseURL} npx tsx scripts/seed-review-fixture.ts`,
      `DATABASE_URL=${databaseURL} npm run dev -- --hostname 127.0.0.1 --port 3100`,
    ].join(" && "),
    url: `${baseURL}/reviews`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseURL,
    },
  },
});
