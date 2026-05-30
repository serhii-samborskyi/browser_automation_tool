log("ai_overview start", input);

const requestText = String(input.request || "").trim();
if (!requestText) {
  return { ok: false, error: "Missing input.request", ai_answer: null };
}

const BLOCK_URL_PARTS = [
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".avif", ".apng",
  ".mp4", ".webm", ".mov", ".m4v", ".avi", ".m3u8", ".ts", ".mp3", ".wav", ".ogg",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  "/gen_204", "/client_204", "/collect", "/ccm/collect",
  "/pagead/", "/ads/", "/ads/measurement", "/pcs/activeview",
  "encrypted-tbn",
  "gstatic.com/images",
  "www.gstatic.com/images",
  "ssl.gstatic.com/images",
  "www.google.com/images",
  "google.com/logos",
  "google.com/doodles",
  "/images/branding",
  "/textinputassistant",
  "fonts.gstatic.com",
  "fonts.googleapis.com",
  "apis.google.com",
  "accounts.google.com/gsi/",
  "www.gstatic.com/og/",
  "ssl.gstatic.com/gb/",
  "www.gstatic.com/gb/",
  "googleusercontent.com",
  "ggpht.com",
  "lh3.googleusercontent.com",
  "google.com/complete/search",
  "google.com/setprefs",
  "google.com/preferences",
  "google.com/async/ddljson"
];

const BLOCK_RESOURCE_TYPES = ["image", "media", "font", "beacon", "csp_report"];

await page.route("**/*", async (route) => {
  const req = route.request();
  const url = req.url().toLowerCase();
  const type = req.resourceType();

  if (
    BLOCK_RESOURCE_TYPES.includes(type) ||
    BLOCK_URL_PARTS.some((part) => url.includes(String(part).toLowerCase()))
  ) {
    try {
      await route.abort("blockedbyclient");
    } catch {
      // ignore
    }
    return;
  }

  try {
    await route.continue();
  } catch {
    // ignore
  }
});

await page.goto("https://google.com/ai", {
  waitUntil: "domcontentloaded",
  timeout: 60000
});
log("opened", page.url());

const prompt = page.locator('textarea[placeholder="Ask anything"]').first();
await prompt.waitFor({ state: "visible", timeout: 30000 });
await prompt.fill(requestText);
const sendButton = page.locator('button[aria-label="Send"]').first();
if (await sendButton.isVisible({ timeout: 5000 }).catch(() => false)) {
  await sendButton.click();
  log("prompt submitted via Send button");
} else {
  await prompt.press("Enter");
  log("prompt submitted via Enter fallback");
}

const mainCol = page.locator('div[data-container-id="main-col"]').first();
await mainCol.waitFor({ state: "visible", timeout: 60000 });
await sleep(3000);

const aiAnswer = await mainCol.evaluate((el) =>
  String(el.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
);

const result = {
  ok: Boolean(aiAnswer),
  ai_answer: aiAnswer || null,
  currentUrl: page.url(),
  request: requestText,
  error: aiAnswer ? null : "Empty main-col content"
};

setResult(result);
return result;
