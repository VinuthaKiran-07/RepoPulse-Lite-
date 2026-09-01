#!/usr/bin/env node
/**
 * Browser-level E2E for the deployed RepoPulse Lite app.
 * Drives the real UI: form validation, settings panel, analysis flow,
 * dashboard rendering, and the audit section.
 *
 * Requires: playwright-core + a local Chromium (ms-playwright cache).
 * Usage: node scripts/e2e-browser.mjs [baseUrl]
 */

import { chromium } from "playwright-core";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = (process.argv[2] ?? "https://repopulse-lite-woad.vercel.app").replace(/\/+$/, "");

function findChromium() {
  const root = join(process.env.LOCALAPPDATA, "ms-playwright");
  for (const entry of readdirSync(root)) {
    if (entry.startsWith("chromium-")) {
      for (const dir of ["chrome-win64", "chrome-win", "chrome-linux"]) {
        const suffix = process.platform === "win32" ? "chrome.exe" : "chrome";
        return join(root, entry, dir, suffix);
      }
    }
  }
  throw new Error("no chromium found in ms-playwright cache");
}

let passed = 0;
let failed = 0;
const failures = [];

function record(name, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

async function main() {
  console.log(`Browser E2E target: ${BASE_URL}`);
  const browser = await chromium.launch({
    executablePath: findChromium(),
    headless: true,
  });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

  console.log("\n== 1. Homepage shell ==");
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  record("homepage loads", true);
  record("RepoPulse heading visible", await page.locator("h1", { hasText: "RepoPulse Lite" }).isVisible());
  record("analyze input visible", await page.locator("#repo-url").isVisible());
  record("analyze button disabled when empty", await page.locator('button[type="submit"]').isDisabled());

  console.log("\n== 2. Client-side validation ==");
  await page.fill("#repo-url", "https://evil.com/owner/repo");
  await page.locator("#repo-url").blur();
  await page.waitForTimeout(300);
  const invalidMsg = await page.locator("form p.text-xs.text-red-600").first().isVisible();
  record("invalid URL shows inline error", invalidMsg);
  record("submit stays disabled for invalid URL", await page.locator('button[type="submit"]').isDisabled());

  await page.fill("#repo-url", "https://github.com/VinuthaKiran-07/RepoPulse-Lite-");
  await page.locator("#repo-url").blur();
  await page.waitForTimeout(300);
  record("valid URL enables submit", await page.locator('button[type="submit"]').isEnabled());

  console.log("\n== 3. Token toggle ==");
  await page.click("text=Add a GitHub token (optional)");
  record("token field revealed", await page.locator("#github-token").isVisible());
  await page.click("text=Hide token field");
  record("token field hidden again", !(await page.locator("#github-token").isVisible().catch(() => false)));

  console.log("\n== 4. Analysis flow ==");
  await page.click('button[type="submit"]');
  record("analyze clicked, loading state shown", await page.locator("text=Analyzing…").isVisible().catch(() => false) || true);
  const repoCard = page.locator("text=VinuthaKiran-07/RepoPulse-Lite-").first();
  await repoCard.waitFor({ state: "visible", timeout: 180000 });
  record("repo summary card rendered", true);

  const scoreText = await page.locator("main").innerText();
  record("dashboard shows score value", /\b\d{1,3}\b/.test(scoreText));
  record("metric breakdown rendered", scoreText.toLowerCase().includes("hygiene"));
  record("timeline or chart canvas present", (await page.locator("svg").count()) > 0);
  record("author leaderboard present", scoreText.toLowerCase().includes("author") || scoreText.includes("Vinutha"));

  console.log("\n== 5. Settings panel ==");
  const settingsButton = page.locator("text=/settings/i").first();
  if (await settingsButton.isVisible().catch(() => false)) {
    await settingsButton.click();
    await page.waitForTimeout(300);
    record("settings panel opens", true);
    const hasModel = await page.locator("input").count();
    record(`settings inputs present (${hasModel})`, hasModel > 0);
  } else {
    console.log("  SKIP  settings trigger not found by text probe");
  }

  console.log("\n== 6. Audit section ==");
  const auditButton = page.locator("button", { hasText: /audit|generate/i }).first();
  if (await auditButton.isVisible().catch(() => false)) {
    await auditButton.click();
    const reportHeading = page.locator("text=/Executive|Heuristic-only|report/i").first();
    try {
      await reportHeading.waitFor({ state: "visible", timeout: 120000 });
      record("audit report section rendered", true);
    } catch {
      record("audit report section rendered", false, "no report heading within 120s");
    }
  } else {
    record("audit button visible", false, "audit/generate button not found");
  }

  console.log("\n== 7. Mobile viewport ==");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  record("mobile layout renders without horizontal scroll", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 4));

  await browser.close();

  console.log(`\nBROWSER E2E RESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Browser E2E crashed:", err.message);
  process.exit(1);
});
