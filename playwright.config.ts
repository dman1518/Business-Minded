import { defineConfig } from "@playwright/test";

/**
 * Responsive/E2E config. Boots the Next.js dev server against a local
 * build and runs tests/responsive/**.spec.ts across the breakpoints
 * required by the mobile-repair brief (320/375/390/430/768/1440 — the
 * per-viewport looping happens inside the spec file itself via
 * test.use({ viewport }), so only one project is needed here).
 */
export default defineConfig({
  testDir: "./tests/responsive",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- -p 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
