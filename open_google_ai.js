import { chromium } from "playwright";

const targetUrl = "https://www.google.com/ai";

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  ignoreDefaultArgs: ["--enable-automation"],
  args: ["--disable-blink-features=AutomationControlled"]
});

const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  console.log("Opened:", page.url());
} catch (err) {
  console.error("Navigation failed:", err?.message || String(err));
}

// Keep browser open for manual inspection.
await page.waitForTimeout(10 * 60 * 1000);
