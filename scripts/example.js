// Available variables: page, context, browser, playwright, log, sleep, config, stopRequested
log("Opening example.com...");
await page.goto("https://api.ipify.org", { waitUntil: "domcontentloaded" });
const title = await page.title();
log("Page title:", title);

// Replace this script with your own automation.
