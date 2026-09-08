import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium as chromiumExtra, request as pwRequest } from "playwright-extra";
import { chromium as chromiumCore, firefox as firefoxCore } from "playwright";
import stealthPlugin from "puppeteer-extra-plugin-stealth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PROFILE_ROOT = path.join(__dirname, "profile");

export const STANDARD_FINGERPRINT_PRESETS = [
  {
    id: "win11-chrome-141",
    label: "Windows 11 + Chrome 141",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    viewportWidth: 1920,
    viewportHeight: 1080,
    locale: "en-US",
    timezoneId: "America/Chicago"
  },
  {
    id: "macos-chrome-141",
    label: "macOS + Chrome 141",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    viewportWidth: 1440,
    viewportHeight: 900,
    locale: "en-US",
    timezoneId: "America/New_York"
  },
  {
    id: "ubuntu-chrome-141",
    label: "Linux + Chrome 141",
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    viewportWidth: 1366,
    viewportHeight: 768,
    locale: "en-US",
    timezoneId: "America/Los_Angeles"
  }
];

const stealth = stealthPlugin();
chromiumExtra.use(stealth);
let chromiumEngine = null;
let fpWarned = false;
let camoufoxApi = null;
let safeCamoufoxSharedBrowser = null;
let safeCamoufoxSharedKey = "";
let safeCamoufoxLaunchInFlight = null;
let safeCamoufoxOpenContexts = 0;
let safeCamoufoxIdleTimer = null;
let safeCamoufoxIdleMs = Math.max(5000, Number(process.env.CAMOUFOX_SHARED_IDLE_MS) || 30000);

async function getChromiumEngine(usePlaywrightWithFingerprints = true) {
  if (!usePlaywrightWithFingerprints) {
    return chromiumExtra;
  }
  if (chromiumEngine) return chromiumEngine;
  try {
    const mod = await import("playwright-with-fingerprints");
    if (mod?.chromium) {
      chromiumEngine = mod.chromium;
      return chromiumEngine;
    }
  } catch {
    // optional dependency path
  }
  if (!fpWarned) {
    fpWarned = true;
    console.log("[fp] playwright-with-fingerprints not available; using playwright-extra engine");
  }
  chromiumEngine = chromiumExtra;
  return chromiumEngine;
}

async function getCamoufoxApi() {
  if (camoufoxApi) return camoufoxApi;
  try {
    const mod = await import("camoufox-js");
    const Camoufox = typeof mod?.Camoufox === "function" ? mod.Camoufox : null;
    const launchOptions = typeof mod?.launchOptions === "function" ? mod.launchOptions : null;
    if (!Camoufox && !launchOptions) {
      throw new Error("camoufox-js loaded but no Camoufox/launchOptions export found");
    }
    camoufoxApi = { Camoufox, launchOptions };
    return camoufoxApi;
  } catch (err) {
    throw new Error(
      `Camoufox engine selected but camoufox-js is not ready (${err?.message || err}). Install with "npm i camoufox-js" and run "npx camoufox-js fetch".`
    );
  }
}

function buildSafeCamoufoxSharedKey(base = {}, proxyOpts = null) {
  const win = Array.isArray(base.window) ? base.window : [];
  return JSON.stringify({
    headless: Boolean(base.headless),
    locale: String(base.locale || "en-US"),
    window: [Number(win[0]) || 1440, Number(win[1]) || 900],
    proxyServer: String(proxyOpts?.server || ""),
    proxyUser: String(proxyOpts?.username || ""),
    proxyPass: String(proxyOpts?.password || "")
  });
}

async function closeSafeCamoufoxSharedBrowser() {
  if (safeCamoufoxIdleTimer) {
    clearTimeout(safeCamoufoxIdleTimer);
    safeCamoufoxIdleTimer = null;
  }
  if (!safeCamoufoxSharedBrowser) return;
  try {
    await safeCamoufoxSharedBrowser.close();
  } catch {
    // ignore close errors
  } finally {
    safeCamoufoxSharedBrowser = null;
    safeCamoufoxSharedKey = "";
    safeCamoufoxOpenContexts = 0;
  }
}

async function getOrCreateSafeCamoufoxSharedBrowser({ Camoufox, launchOptions, camoufoxBase, proxyOpts }) {
  const targetKey = buildSafeCamoufoxSharedKey(camoufoxBase, proxyOpts);

  if (
    safeCamoufoxSharedBrowser &&
    safeCamoufoxSharedBrowser.isConnected?.() &&
    safeCamoufoxSharedKey === targetKey
  ) {
    return safeCamoufoxSharedBrowser;
  }

  if (safeCamoufoxLaunchInFlight) {
    await safeCamoufoxLaunchInFlight;
    if (
      safeCamoufoxSharedBrowser &&
      safeCamoufoxSharedBrowser.isConnected?.() &&
      safeCamoufoxSharedKey === targetKey
    ) {
      return safeCamoufoxSharedBrowser;
    }
  }

  safeCamoufoxLaunchInFlight = (async () => {
    if (safeCamoufoxSharedBrowser && safeCamoufoxSharedKey !== targetKey) {
      await closeSafeCamoufoxSharedBrowser();
    }

    if (!safeCamoufoxSharedBrowser) {
      if (launchOptions) {
        const generated = await launchOptions(camoufoxBase);
        safeCamoufoxSharedBrowser = await firefoxCore.launch({
          ...generated,
          headless: camoufoxBase.headless,
          proxy: proxyOpts || undefined
        });
      } else if (Camoufox) {
        const launched = await Camoufox(camoufoxBase);
        if (!launched?.newContext) {
          throw new Error("Safe mode requires Camoufox browser object with newContext()");
        }
        safeCamoufoxSharedBrowser = launched;
      } else {
        throw new Error("Safe mode Camoufox launch unavailable");
      }
      safeCamoufoxSharedKey = targetKey;
    }
  })();

  try {
    await safeCamoufoxLaunchInFlight;
  } finally {
    safeCamoufoxLaunchInFlight = null;
  }

  return safeCamoufoxSharedBrowser;
}

function normalizeProxyRaw(raw) {
  const str = String(raw || "").trim();
  if (!str) return "";
  const swap = str.match(/^([^@]+)@([0-9]+):([0-9]{1,3}(?:\.[0-9]{1,3}){3})$/);
  if (swap) return `${swap[1]}@${swap[3]}:${swap[2]}`;
  return str;
}

function parseProxyCandidates(proxyString, preferredProtocol) {
  const raw = normalizeProxyRaw(proxyString);
  if (!raw) return [];

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw);
  let schemeList = [];

  if (preferredProtocol) {
    const low = String(preferredProtocol).toLowerCase();
    if (low === "https") schemeList = ["http"];
    else if (["http", "socks4", "socks5"].includes(low)) {
      schemeList = [low];
      if (low === "socks4") schemeList.push("socks5");
    }
  }

  const inputs = hasScheme
    ? [raw]
    : schemeList.length
    ? schemeList.map((scheme) => `${scheme}://${raw}`)
    : [`http://${raw}`, `socks5://${raw}`];

  const parsed = [];
  for (const input of inputs) {
    try {
      const urlObj = new URL(input.replace(/^https:/i, "http:"));
      let protocol = (urlObj.protocol || "").toLowerCase();
      if (protocol === "https:") protocol = "http:";
      if (protocol !== "http:" && protocol !== "socks5:") continue;

      const host = urlObj.hostname;
      const port = urlObj.port || (protocol === "http:" ? "80" : "1080");
      if (!host) continue;

      parsed.push({
        server: `${protocol}//${host}${port ? `:${port}` : ""}`,
        username: urlObj.username || undefined,
        password: urlObj.password || undefined,
        protocol
      });
    } catch {
      // ignore malformed candidate
    }
  }

  return parsed;
}

export function parseProxy(proxyString) {
  const candidates = parseProxyCandidates(proxyString);
  return candidates[0] || null;
}

export async function testProxyConnection(proxyString, preferredProtocol) {
  const candidates = parseProxyCandidates(proxyString, preferredProtocol);
  if (!candidates.length) {
    throw new Error("Invalid proxy format. Use host:port, login:pass@host:port, or protocol://...");
  }

  const startedAll = Date.now();
  let lastError = null;

  for (const base of candidates) {
    const protocol = base.protocol === "socks5:" ? "socks5" : "http";
    const attempts = [];

    if (protocol === "socks5") {
      attempts.push({ ...base, username: undefined, password: undefined, auth: "none" });
      if (base.username) attempts.push({ ...base, auth: "auth" });
    } else {
      attempts.push({ ...base, auth: base.username ? "auth" : "none" });
      if (base.username) attempts.push({ ...base, username: undefined, password: undefined, auth: "none" });
    }

    for (const candidate of attempts) {
      const started = Date.now();
      let req = null;
      try {
        req = await pwRequest.newContext({
          proxy: {
            server: candidate.server,
            username: candidate.username,
            password: candidate.password
          },
          timeout: 12000
        });

        const response = await req.get("https://example.com", { timeout: 12000 });

        return {
          ok: true,
          reachable: true,
          protocol,
          auth: candidate.auth,
          status: response.status(),
          httpOk: response.ok(),
          durationMs: Date.now() - started
        };
      } catch (err) {
        lastError = {
          ok: false,
          reachable: false,
          protocol,
          auth: candidate.auth,
          error: err?.message || "Proxy test failed",
          durationMs: Date.now() - started
        };
      } finally {
        try {
          await req?.dispose();
        } catch {
          // ignore
        }
      }
    }
  }

  return lastError || { ok: false, error: "Proxy test failed", durationMs: Date.now() - startedAll };
}

async function injectAdvancedFingerprint(context, options = {}) {
  const {
    userAgent = "",
    viewportWidth = 1440,
    viewportHeight = 900,
    locale = "en-US",
    timezoneId = "America/Chicago"
  } = options;

  try {
    const { FingerprintGenerator } = await import("fingerprint-generator");
    const { FingerprintInjector } = await import("fingerprint-injector");

    const generator = new FingerprintGenerator({
      browsers: [{ name: "chrome", minVersion: 130 }],
      devices: ["desktop"],
      operatingSystems: ["windows", "macos", "linux"]
    });

    const generated = generator.getFingerprint({
      locales: [locale || "en-US"],
      timezone: { id: timezoneId || "America/Chicago" }
    });

    const fp = generated.fingerprint;
    if (userAgent) {
      fp.navigator.userAgent = userAgent;
      if (generated.headers) generated.headers["user-agent"] = userAgent;
    }
    fp.screen.width = Number(viewportWidth) || 1440;
    fp.screen.height = Number(viewportHeight) || 900;
    if (fp.screen.viewport) {
      fp.screen.viewport.width = Number(viewportWidth) || 1440;
      fp.screen.viewport.height = Number(viewportHeight) || 900;
    }
    if (fp.navigator) {
      fp.navigator.language = (locale || "en-US").split(",")[0];
      fp.navigator.languages = [fp.navigator.language, "en"];
      fp.navigator.timezone = timezoneId || "America/Chicago";
    }

    const injector = new FingerprintInjector();
    await injector.attachFingerprintToPlaywright(context, generated);
  } catch (err) {
    console.warn("[fp] advanced fingerprint injection failed", err?.message);
  }

}

export async function launchBrowserSession(options = {}) {
  const {
    profileName = "default",
    browserEngine = "chromium",
    headless = false,
    proxy = "",
    userAgent = "",
    viewportWidth = 1440,
    viewportHeight = 900,
    locale = "en-US",
    timezoneId = "America/Chicago",
    advancedFingerprintMode = true,
    usePlaywrightWithFingerprints = true,
    safeModeSharedBrowserIdleMs = 30000,
    ephemeral = false,
    safeModeEnabled = false
  } = options;

  const proxyOpts = parseProxy(proxy);
  const engineName = String(browserEngine || "").toLowerCase();
  const useChromeChannel = engineName === "chrome";
  const useCamoufox = engineName === "camoufox";
  const engine = useCamoufox
    ? null
    : useChromeChannel
    ? chromiumCore
    : await getChromiumEngine(usePlaywrightWithFingerprints);
  const launchArgs = useChromeChannel
    ? [
        "--disable-blink-features=AutomationControlled",
        ...(process.env.CONTAINERIZED === "true" ? ["--no-sandbox"] : [])
      ]
    : ["--disable-notifications", "--no-sandbox", "--disable-features=IsolateOrigins,site-per-process"];
  const ignoreDefaultArgs = useChromeChannel ? ["--enable-automation"] : ["--disable-extensions"];
  const channel = useChromeChannel ? "chrome" : undefined;
  safeCamoufoxIdleMs = Math.max(5000, Number(safeModeSharedBrowserIdleMs) || safeCamoufoxIdleMs);

  let context;
  let launchedBrowser = null;
  let sharedCamoufoxContext = false;
  const useSafeCamoufoxReuse = useCamoufox && Boolean(safeModeEnabled);

  const profileDir = path.join(PROFILE_ROOT, String(profileName || "default"));
  if (!ephemeral && !useSafeCamoufoxReuse) {
    fs.mkdirSync(profileDir, { recursive: true });

    const lockPath = path.join(profileDir, "SingletonLock");
    if (fs.existsSync(lockPath)) {
      try {
        fs.rmSync(lockPath, { force: true });
      } catch {
        // ignore
      }
    }
  }

  const contextDefaults = {
    viewport: { width: Number(viewportWidth) || 1440, height: Number(viewportHeight) || 900 },
    userAgent: userAgent || undefined,
    locale: locale || "en-US",
    timezoneId: timezoneId || "America/Chicago"
  };

  if (useCamoufox) {
    const { Camoufox, launchOptions } = await getCamoufoxApi();
    const camoufoxProxy =
      proxyOpts && proxyOpts.server
        ? {
            server: proxyOpts.server,
            username: proxyOpts.username,
            password: proxyOpts.password
          }
        : undefined;

    const camoufoxBase = {
      headless,
      proxy: camoufoxProxy,
      locale: locale || "en-US",
      window: [Number(viewportWidth) || 1440, Number(viewportHeight) || 900]
    };

    if (useSafeCamoufoxReuse) {
      const sharedBrowser = await getOrCreateSafeCamoufoxSharedBrowser({
        Camoufox,
        launchOptions,
        camoufoxBase,
        proxyOpts
      });
      if (safeCamoufoxIdleTimer) {
        clearTimeout(safeCamoufoxIdleTimer);
        safeCamoufoxIdleTimer = null;
      }
      context = await sharedBrowser.newContext(contextDefaults);
      safeCamoufoxOpenContexts += 1;
      sharedCamoufoxContext = true;
    } else if (Camoufox) {
      const launched = await Camoufox(
        ephemeral
          ? camoufoxBase
          : { ...camoufoxBase, persistent_context: true, user_data_dir: profileDir }
      );
      if (launched?.pages && launched?.newPage && launched?.close) {
        context = launched;
      } else if (launched?.newContext) {
        // Camoufox returned a Browser rather than a persistent context. Keep
        // ownership so close() tears down the browser process after its context.
        launchedBrowser = launched;
        context = await launched.newContext(contextDefaults);
      } else {
        throw new Error("Camoufox returned an unsupported browser object");
      }
    } else if (launchOptions) {
      const generated = await launchOptions(
        ephemeral
          ? camoufoxBase
          : { ...camoufoxBase, persistent_context: true, user_data_dir: profileDir }
      );

      if (ephemeral) {
        const browser = await firefoxCore.launch({
          ...generated,
          headless,
          proxy: proxyOpts || undefined
        });
        launchedBrowser = browser;
        context = await browser.newContext(contextDefaults);
      } else {
        context = await firefoxCore.launchPersistentContext(profileDir, {
          ...generated,
          headless,
          proxy: proxyOpts || undefined,
          ...contextDefaults
        });
      }
    }
  } else if (useChromeChannel) {
    const browser = await engine.launch({
      headless,
      channel,
      args: launchArgs,
      ignoreDefaultArgs,
      proxy: proxyOpts || undefined
    });
    launchedBrowser = browser;
    context = await browser.newContext(contextDefaults);
  } else if (ephemeral) {
    const browser = await engine.launch({
      headless,
      channel,
      args: launchArgs,
      ignoreDefaultArgs,
      proxy: proxyOpts || undefined
    });
    launchedBrowser = browser;
    context = await browser.newContext(contextDefaults);
  } else {
    context = await engine.launchPersistentContext(profileDir, {
      headless,
      channel,
      args: launchArgs,
      ignoreDefaultArgs,
      proxy: proxyOpts || undefined,
      ...contextDefaults
    });
  }

  if (!context) {
    throw new Error("Failed to create browser context");
  }

  if (advancedFingerprintMode && !useChromeChannel && !useCamoufox) {
    await injectAdvancedFingerprint(context, {
      userAgent,
      viewportWidth,
      viewportHeight,
      locale,
      timezoneId
    });
  }
  let page = context.pages()[0] || null;
  if (!page) {
    page = await context.newPage();
  } else {
    try {
      await page.bringToFront();
    } catch {
      // ignore focus errors
    }
  }

  const close = async () => {
    try {
      await page?.close?.();
    } catch {
      // ignore
    }
    try {
      await context.close();
    } catch {
      // ignore
    }
    if (sharedCamoufoxContext) {
      safeCamoufoxOpenContexts = Math.max(0, safeCamoufoxOpenContexts - 1);
      if (safeCamoufoxOpenContexts === 0 && safeCamoufoxSharedBrowser) {
        safeCamoufoxIdleTimer = setTimeout(() => {
          void closeSafeCamoufoxSharedBrowser();
        }, safeCamoufoxIdleMs);
      }
      return;
    }
    if (launchedBrowser) {
      try {
        await launchedBrowser.close();
      } catch {
        // ignore
      }
    }
  };

  return {
    context,
    browser: context.browser?.() || null,
    page,
    isSharedCamoufoxContext: sharedCamoufoxContext,
    close
  };
}

export function getProfileDir(profileName) {
  return path.join(PROFILE_ROOT, String(profileName || "default"));
}

export async function recreateProfile(profileName) {
  const profileDir = getProfileDir(profileName);
  try {
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
    fs.mkdirSync(profileDir, { recursive: true });
    return { ok: true, profileDir };
  } catch (err) {
    return { ok: false, profileDir, error: err?.message || "Failed to recreate profile" };
  }
}

export function sanitizeScriptName(name) {
  const base = String(name || "").trim().replace(/\\/g, "/").split("/").pop() || "";
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe) return "";
  return safe.endsWith(".js") ? safe : `${safe}.js`;
}
