log("ai_overview start", input);

const requestText = String(input.request || "").trim();
if (!requestText) {
  return { ok: false, error: "Missing input.request", ai_answer: null };
}

const SHARED_SCRIPT_CACHE = globalThis.__AI_OVERVIEW_SHARED_SCRIPT_CACHE__ || new Map();
globalThis.__AI_OVERVIEW_SHARED_SCRIPT_CACHE__ = SHARED_SCRIPT_CACHE;
const SCRIPT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SCRIPT_CACHE_MAX_ITEMS = 24;
const SCRIPT_CACHE_MAX_BODY_BYTES = 2 * 1024 * 1024;
const CACHED_SCRIPT_PATTERNS = [
  "www.gstatic.com/_/mss/search-next/",
  "www.google.com/xjs/_/js/"
];
const VOLATILE_PATH_SEGMENT_PREFIXES = ["rs=", "cb="];

function isCacheableScriptUrl(rawUrl, resourceType) {
  if (resourceType !== "script") return false;
  const url = String(rawUrl || "").toLowerCase();
  return CACHED_SCRIPT_PATTERNS.some((part) => url.includes(part));
}

function getScriptCacheKey(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ""));
  } catch {
    return String(rawUrl || "").toLowerCase();
  }
  const pathnameSegments = String(parsed.pathname || "")
    .split("/")
    .filter(Boolean)
    .filter((seg) => {
      const s = seg.toLowerCase();
      return !VOLATILE_PATH_SEGMENT_PREFIXES.some((p) => s.startsWith(p));
    });

  const getPart = (prefix) => {
    const found = pathnameSegments.find((seg) => seg.startsWith(prefix));
    return found || "";
  };

  const host = parsed.hostname.toLowerCase();
  if (host === "www.gstatic.com" && pathnameSegments.includes("search-next")) {
    return [
      "gstatic-search-next",
      getPart("k="),
      getPart("ck="),
      getPart("m="),
      getPart("d=")
    ].join("|");
  }

  if (host === "www.google.com" && pathnameSegments.includes("xjs")) {
    return [
      "google-xjs",
      getPart("k="),
      getPart("m="),
      getPart("d="),
      getPart("br="),
      getPart("ichc=")
    ].join("|");
  }

  return `${parsed.origin.toLowerCase()}/${pathnameSegments.join("/")}`;
}

function pruneScriptCache(now = Date.now()) {
  for (const [cacheKey, entry] of SHARED_SCRIPT_CACHE.entries()) {
    if (!entry || Number(entry.expiresAt || 0) <= now) {
      SHARED_SCRIPT_CACHE.delete(cacheKey);
    }
  }
  while (SHARED_SCRIPT_CACHE.size > SCRIPT_CACHE_MAX_ITEMS) {
    const oldestKey = SHARED_SCRIPT_CACHE.keys().next().value;
    if (!oldestKey) break;
    SHARED_SCRIPT_CACHE.delete(oldestKey);
  }
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

  if (isCacheableScriptUrl(url, type)) {
    const cacheKey = getScriptCacheKey(url);
    const now = Date.now();
    pruneScriptCache(now);
    const cached = SHARED_SCRIPT_CACHE.get(cacheKey);
    if (cached && Number(cached.expiresAt || 0) > now) {
      try {
        await route.fulfill({
          status: Number(cached.status) || 200,
          headers: { ...(cached.headers || {}), "x-ai-cache": "hit" },
          body: Buffer.from(String(cached.bodyBase64 || ""), "base64")
        });
        log("script cache hit", cacheKey);
        return;
      } catch {
        SHARED_SCRIPT_CACHE.delete(cacheKey);
      }
    }

    try {
      const response = await route.fetch();
      const body = await response.body();
      const headers = response.headers();
      const status = response.status();

      if (
        status >= 200 &&
        status < 300 &&
        Buffer.isBuffer(body) &&
        body.length > 0 &&
        body.length <= SCRIPT_CACHE_MAX_BODY_BYTES
      ) {
        SHARED_SCRIPT_CACHE.set(cacheKey, {
          status,
          headers,
          bodyBase64: body.toString("base64"),
          expiresAt: Date.now() + SCRIPT_CACHE_TTL_MS
        });
        pruneScriptCache();
        log("script cache store", `${cacheKey} (${body.length} bytes)`);
      }

      await route.fulfill({ response, body, headers: { ...headers, "x-ai-cache": "miss" } });
      return;
    } catch (cacheErr) {
      log("script cache bypass", String(cacheErr && cacheErr.message ? cacheErr.message : cacheErr));
      try {
        await route.continue();
      } catch {
        // ignore
      }
      return;
    }
  }

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
