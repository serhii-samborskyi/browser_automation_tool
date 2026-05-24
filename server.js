import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import util from "util";
import { fileURLToPath } from "url";
import * as playwright from "playwright";
import {
  launchBrowserSession,
  testProxyConnection,
  sanitizeScriptName,
  recreateProfile,
  STANDARD_FINGERPRINT_PRESETS
} from "./browser_setup.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const SCRIPTS_DIR = path.join(__dirname, "scripts");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const ROTATION_STATE_PATH = path.join(DATA_DIR, "rotation_state.json");

const DEFAULT_CONFIG = {
  profileName: "default",
  browserEngine: "chromium",
  headless: false,
  proxy: "",
  userAgent: "",
  viewportWidth: 1440,
  viewportHeight: 900,
  locale: "en-US",
  timezoneId: "America/Chicago",
  advancedFingerprintMode: true,
  usePlaywrightWithFingerprints: true,
  measureTrafficUsage: false,
  timeoutMs: 120000,
  keepBrowserOpenOnFinish: false,
  rotateProfileEveryNRequests: 0,
  rotateFingerprintWithProfile: false
};

const DEFAULT_ROTATION_STATE = {
  requestCountSinceRotation: 0,
  totalRequests: 0,
  lastRotatedAt: null,
  lastProfileName: null,
  lastPresetId: null
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(SCRIPTS_DIR, { recursive: true });

function readPortFromIni() {
  try {
    const iniPath = path.join(__dirname, "config.ini");
    if (!fs.existsSync(iniPath)) return null;

    const raw = fs.readFileSync(iniPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) continue;
      const match = trimmed.match(/^port\s*=\s*(\d+)/i);
      if (match) return Number(match[1]);
    }
  } catch {
    // ignore
  }
  return null;
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
      return { ...DEFAULT_CONFIG };
    }
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      browserEngine: normalizeBrowserEngine(parsed?.browserEngine || DEFAULT_CONFIG.browserEngine),
      rotateProfileEveryNRequests: normalizeRotateEvery(parsed?.rotateProfileEveryNRequests),
      rotateFingerprintWithProfile: Boolean(parsed?.rotateFingerprintWithProfile)
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function normalizeBrowserEngine(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "camoufox") return "camoufox";
  return raw === "chrome" ? "chrome" : "chromium";
}

function isTruthy(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function normalizeRotateEvery(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function readRotationState() {
  try {
    if (!fs.existsSync(ROTATION_STATE_PATH)) {
      fs.writeFileSync(ROTATION_STATE_PATH, `${JSON.stringify(DEFAULT_ROTATION_STATE, null, 2)}\n`, "utf8");
      return { ...DEFAULT_ROTATION_STATE };
    }
    const parsed = JSON.parse(fs.readFileSync(ROTATION_STATE_PATH, "utf8"));
    return {
      ...DEFAULT_ROTATION_STATE,
      ...parsed,
      requestCountSinceRotation: Math.max(0, Number(parsed?.requestCountSinceRotation) || 0),
      totalRequests: Math.max(0, Number(parsed?.totalRequests) || 0)
    };
  } catch {
    return { ...DEFAULT_ROTATION_STATE };
  }
}

function writeRotationState(next) {
  const state = { ...DEFAULT_ROTATION_STATE, ...(next || {}) };
  fs.writeFileSync(ROTATION_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

function pickRandomFingerprintPreset() {
  if (!Array.isArray(STANDARD_FINGERPRINT_PRESETS) || !STANDARD_FINGERPRINT_PRESETS.length) return null;
  const idx = Math.floor(Math.random() * STANDARD_FINGERPRINT_PRESETS.length);
  return STANDARD_FINGERPRINT_PRESETS[idx];
}

async function maybeRotateProfileAndFingerprint(config, logFn = () => {}) {
  const every = normalizeRotateEvery(config?.rotateProfileEveryNRequests);
  if (!every) {
    return { config, rotated: false };
  }

  const state = readRotationState();
  state.requestCountSinceRotation += 1;
  state.totalRequests += 1;

  if (state.requestCountSinceRotation < every) {
    writeRotationState(state);
    return { config, rotated: false, state };
  }

  const profileName = String(config?.profileName || "default");
  const recreated = await recreateProfile(profileName);
  if (!recreated.ok) {
    logFn(`[rotate] failed to recreate profile ${profileName}: ${recreated.error || "unknown error"}`);
    writeRotationState(state);
    return { config, rotated: false, state };
  }

  let nextConfig = { ...config };
  let appliedPreset = null;

  if (config?.rotateFingerprintWithProfile) {
    const preset = pickRandomFingerprintPreset();
    if (preset) {
      appliedPreset = preset;
      nextConfig = {
        ...nextConfig,
        userAgent: String(preset.userAgent || ""),
        viewportWidth: Number(preset.viewportWidth) || nextConfig.viewportWidth,
        viewportHeight: Number(preset.viewportHeight) || nextConfig.viewportHeight,
        locale: String(preset.locale || nextConfig.locale || "en-US"),
        timezoneId: String(preset.timezoneId || nextConfig.timezoneId || "America/Chicago")
      };

      writeConfig({
        userAgent: nextConfig.userAgent,
        viewportWidth: nextConfig.viewportWidth,
        viewportHeight: nextConfig.viewportHeight,
        locale: nextConfig.locale,
        timezoneId: nextConfig.timezoneId
      });
    }
  }

  state.requestCountSinceRotation = 0;
  state.lastRotatedAt = new Date().toISOString();
  state.lastProfileName = profileName;
  state.lastPresetId = appliedPreset?.id || null;
  writeRotationState(state);

  if (appliedPreset) {
    logFn(`[rotate] profile recreated + fingerprint preset applied: ${appliedPreset.label}`);
  } else {
    logFn(`[rotate] profile recreated: ${profileName}`);
  }

  return {
    config: nextConfig,
    rotated: true,
    state,
    appliedPresetId: appliedPreset?.id || null
  };
}

function ensureSampleScript() {
  const samplePath = path.join(SCRIPTS_DIR, "example.js");
  if (fs.existsSync(samplePath)) return;

  const sample = `// Available variables: page, context, browser, playwright, log, sleep, config, stopRequested\nlog("Opening example.com...");\nawait page.goto("https://example.com", { waitUntil: "domcontentloaded" });\nconst title = await page.title();\nlog("Page title:", title);\n\n// Replace this script with your own automation.\n`;
  fs.writeFileSync(samplePath, sample, "utf8");
}

ensureSampleScript();

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

const runs = new Map();
const runOrder = [];
const MAX_STORED_RUNS = 60;
const MAX_RUN_LOG_LINES = 800;
const MAX_SYNC_LOG_LINES = 300;

function makeRunSummary(run) {
  return {
    id: run.id,
    scriptName: run.scriptName,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    error: run.error,
    timeoutMs: run.timeoutMs,
    traffic: run.traffic || null,
    ephemeral: run.ephemeral,
    keepBrowserOpenOnFinish: run.keepBrowserOpenOnFinish,
    logCount: run.logs.length
  };
}

function addRunLog(run, ...args) {
  const line = args
    .map((v) => (typeof v === "string" ? v : util.inspect(v, { depth: 4, breakLength: 120 })))
    .join(" ");

  run.logs.push({
    ts: new Date().toISOString(),
    line
  });

  if (run.logs.length > MAX_RUN_LOG_LINES) {
    run.logs.splice(0, run.logs.length - MAX_RUN_LOG_LINES);
  }
}

async function cleanupRunResources(run) {
  if (!run) return;
  if (typeof run.stop === "function") {
    try {
      await run.stop();
    } catch {
      // ignore
    }
  }
}

async function evictOldRunsIfNeeded(currentRunId) {
  while (runOrder.length > MAX_STORED_RUNS) {
    const dropId = runOrder.pop();
    if (!dropId || dropId === currentRunId) continue;
    const dropRun = runs.get(dropId);
    if (dropRun && dropRun.status === "done" && dropRun.keepBrowserOpenOnFinish) {
      await cleanupRunResources(dropRun);
    }
    runs.delete(dropId);
  }
}

async function createTrafficMeter(page, enabled, logFn = () => {}) {
  if (!enabled) {
    return {
      stop: async () => {},
      getStats: () => null
    };
  }

  let totalBytes = 0;
  let requestCount = 0;
  let responseCount = 0;
  let method = "headers-content-length";
  let cdp = null;
  const cleanups = [];

  const onRequest = () => {
    requestCount += 1;
  };
  page.on("request", onRequest);
  cleanups.push(() => page.off("request", onRequest));

  const onResponseCount = () => {
    responseCount += 1;
  };
  page.on("response", onResponseCount);
  cleanups.push(() => page.off("response", onResponseCount));

  try {
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    method = "cdp-encoded-data-length";
    const onLoadingFinished = (event) => {
      const n = Number(event?.encodedDataLength || 0);
      if (Number.isFinite(n) && n > 0) totalBytes += n;
    };
    cdp.on("Network.loadingFinished", onLoadingFinished);
    cleanups.push(() => cdp.off("Network.loadingFinished", onLoadingFinished));
  } catch (err) {
    logFn(`[traffic] CDP meter unavailable, fallback to content-length headers: ${err?.message || err}`);
    const onResponseLength = async (resp) => {
      try {
        const headers = resp.headers();
        const n = Number(headers["content-length"] || 0);
        if (Number.isFinite(n) && n > 0) totalBytes += n;
      } catch {
        // ignore
      }
    };
    page.on("response", onResponseLength);
    cleanups.push(() => page.off("response", onResponseLength));
  }

  return {
    stop: async () => {
      for (const off of cleanups) {
        try {
          off();
        } catch {
          // ignore
        }
      }
      if (cdp) {
        try {
          await cdp.detach();
        } catch {
          // ignore
        }
      }
    },
    getStats: () => ({
      enabled: true,
      method,
      requestCount,
      responseCount,
      bytes: Math.max(0, Math.floor(totalBytes)),
      megabytes: Number((Math.max(0, totalBytes) / (1024 * 1024)).toFixed(3))
    })
  };
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function executeScriptSync({ scriptName, code, config, ephemeral, input = {} }) {
  const started = Date.now();
  const logs = [];
  let session = null;
  let timeout = null;
  let explicitResult;
  let runConfig = { ...config };
  let trafficMeter = null;

  const pushLog = (...args) => {
    const line = args
      .map((v) => (typeof v === "string" ? v : util.inspect(v, { depth: 4, breakLength: 120 })))
      .join(" ");
    logs.push({
      ts: new Date().toISOString(),
      line
    });
    if (logs.length > MAX_SYNC_LOG_LINES) logs.splice(0, logs.length - MAX_SYNC_LOG_LINES);
  };

  const setResult = (value) => {
    explicitResult = value;
  };

  try {
    const rotation = await maybeRotateProfileAndFingerprint(runConfig, (...args) => pushLog(...args));
    runConfig = rotation?.config || runConfig;

    session = await launchBrowserSession({
      profileName: runConfig.profileName,
      browserEngine: runConfig.browserEngine,
      headless: runConfig.headless,
      proxy: runConfig.proxy,
      userAgent: runConfig.userAgent,
      viewportWidth: runConfig.viewportWidth,
      viewportHeight: runConfig.viewportHeight,
      locale: runConfig.locale,
      timezoneId: runConfig.timezoneId,
      advancedFingerprintMode: runConfig.advancedFingerprintMode,
      usePlaywrightWithFingerprints: runConfig.usePlaywrightWithFingerprints,
      ephemeral: Boolean(ephemeral)
    });
    trafficMeter = await createTrafficMeter(session.page, Boolean(runConfig.measureTrafficUsage), (...args) => pushLog(...args));

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    const stopRequested = () => false;
    const fn = new AsyncFunction(
      "page",
      "context",
      "browser",
      "playwright",
      "log",
      "sleep",
      "config",
      "stopRequested",
      "input",
      "setResult",
      code
    );

    const timeoutMs = Number(runConfig.timeoutMs) || DEFAULT_CONFIG.timeoutMs;
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error(`Script timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const returned = await Promise.race([
      fn(
        session.page,
        session.context,
        session.browser,
        playwright,
        (...args) => pushLog(...args),
        sleep,
        { ...runConfig, ephemeral: Boolean(ephemeral) },
        stopRequested,
        input,
        setResult
      ),
      timeoutPromise
    ]);

    const traffic = trafficMeter.getStats();
    return {
      ok: true,
      scriptName,
      durationMs: Date.now() - started,
      result: explicitResult !== undefined ? explicitResult : returned ?? null,
      traffic,
      logs
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    try {
      await trafficMeter?.stop?.();
    } catch {
      // ignore
    }
    try {
      await session?.close?.();
    } catch {
      // ignore close errors
    }
  }
}

async function runScript({ scriptName, code, config, ephemeral, input = {} }) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const run = {
    id: runId,
    scriptName,
    status: "queued",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    timeoutMs: Number(config.timeoutMs) || DEFAULT_CONFIG.timeoutMs,
    ephemeral: Boolean(ephemeral),
    keepBrowserOpenOnFinish: Boolean(config.keepBrowserOpenOnFinish),
    traffic: null,
    logs: [],
    stopRequested: false,
    stop: null
  };

  runs.set(runId, run);
  runOrder.unshift(runId);
  void evictOldRunsIfNeeded(runId);

  (async () => {
    let session = null;
    let timeout = null;
    let runConfig = { ...config };
    let trafficMeter = null;

    try {
      run.status = "running";
      addRunLog(run, `[run] starting script ${scriptName}`);
      const rotation = await maybeRotateProfileAndFingerprint(runConfig, (...args) => addRunLog(run, ...args));
      runConfig = rotation?.config || runConfig;

      session = await launchBrowserSession({
        profileName: runConfig.profileName,
        browserEngine: runConfig.browserEngine,
        headless: runConfig.headless,
        proxy: runConfig.proxy,
        userAgent: runConfig.userAgent,
        viewportWidth: runConfig.viewportWidth,
        viewportHeight: runConfig.viewportHeight,
        locale: runConfig.locale,
        timezoneId: runConfig.timezoneId,
        advancedFingerprintMode: runConfig.advancedFingerprintMode,
        usePlaywrightWithFingerprints: runConfig.usePlaywrightWithFingerprints,
        ephemeral: Boolean(ephemeral)
      });
      trafficMeter = await createTrafficMeter(session.page, Boolean(runConfig.measureTrafficUsage), (...args) =>
        addRunLog(run, ...args)
      );

      run.stop = async () => {
        run.stopRequested = true;
        try {
          await session?.close?.();
        } catch {
          // ignore
        }
      };

      const stopRequested = () => run.stopRequested;
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
      const log = (...args) => addRunLog(run, ...args);
      let explicitResult;
      const setResult = (value) => {
        explicitResult = value;
      };

      const fn = new AsyncFunction(
        "page",
        "context",
        "browser",
        "playwright",
        "log",
        "sleep",
        "config",
        "stopRequested",
        "input",
        "setResult",
        code
      );

      const timeoutMs = Number(run.timeoutMs) || DEFAULT_CONFIG.timeoutMs;
      const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Script timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      await Promise.race([
        fn(
          session.page,
          session.context,
          session.browser,
          playwright,
          log,
          sleep,
          { ...runConfig, ephemeral: Boolean(ephemeral) },
          stopRequested,
          input,
          setResult
        ),
        timeoutPromise
      ]);

      if (run.stopRequested) {
        run.status = "stopped";
        addRunLog(run, "[run] stopped");
      } else {
        run.status = "done";
        addRunLog(run, "[run] completed");
        if (explicitResult !== undefined) {
          addRunLog(run, "[run] result", explicitResult);
        }
      }
      run.traffic = trafficMeter.getStats();
      if (run.traffic) {
        addRunLog(
          run,
          `[traffic] ${run.traffic.megabytes} MB (${run.traffic.bytes} bytes), ${run.traffic.requestCount} requests, mode=${run.traffic.method}`
        );
      }
    } catch (err) {
      run.status = run.stopRequested ? "stopped" : "failed";
      run.error = err?.stack || err?.message || String(err);
      addRunLog(run, `[run] error: ${run.error}`);
    } finally {
      if (timeout) clearTimeout(timeout);
      try {
        await trafficMeter?.stop?.();
      } catch {
        // ignore
      }
      const shouldKeepOpen =
        Boolean(run.keepBrowserOpenOnFinish) &&
        run.status === "done" &&
        !run.stopRequested;
      if (!shouldKeepOpen) {
        try {
          await session?.close?.();
        } catch {
          // ignore
        }
      } else {
        addRunLog(run, "[run] keepBrowserOpenOnFinish=true, browser left open");
      }
      run.finishedAt = new Date().toISOString();
      if (!shouldKeepOpen) run.stop = null;
    }
  })();

  return run;
}

function listScriptFiles() {
  return fs
    .readdirSync(SCRIPTS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".js"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

const app = express();
const port = process.env.PORT || readPortFromIni() || 4000;

app.use(bodyParser.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.get("/api/config", (_req, res) => {
  res.json(readConfig());
});

app.post("/api/config", (req, res) => {
  const body = req.body || {};
  const next = writeConfig({
    profileName: String(body.profileName || "default"),
    browserEngine: normalizeBrowserEngine(body.browserEngine || DEFAULT_CONFIG.browserEngine),
    headless: Boolean(body.headless),
    proxy: String(body.proxy || ""),
    userAgent: String(body.userAgent || ""),
    viewportWidth: Number(body.viewportWidth) || DEFAULT_CONFIG.viewportWidth,
    viewportHeight: Number(body.viewportHeight) || DEFAULT_CONFIG.viewportHeight,
    locale: String(body.locale || DEFAULT_CONFIG.locale),
    timezoneId: String(body.timezoneId || DEFAULT_CONFIG.timezoneId),
    advancedFingerprintMode:
      body.advancedFingerprintMode === undefined
        ? DEFAULT_CONFIG.advancedFingerprintMode
        : Boolean(body.advancedFingerprintMode),
    usePlaywrightWithFingerprints:
      body.usePlaywrightWithFingerprints === undefined
        ? DEFAULT_CONFIG.usePlaywrightWithFingerprints
        : Boolean(body.usePlaywrightWithFingerprints),
    measureTrafficUsage:
      body.measureTrafficUsage === undefined
        ? DEFAULT_CONFIG.measureTrafficUsage
        : Boolean(body.measureTrafficUsage),
    timeoutMs: Number(body.timeoutMs) || DEFAULT_CONFIG.timeoutMs,
    keepBrowserOpenOnFinish: Boolean(body.keepBrowserOpenOnFinish),
    rotateProfileEveryNRequests: normalizeRotateEvery(body.rotateProfileEveryNRequests),
    rotateFingerprintWithProfile: Boolean(body.rotateFingerprintWithProfile)
  });
  res.json(next);
});

app.get("/api/fingerprint-presets", (_req, res) => {
  res.json(STANDARD_FINGERPRINT_PRESETS);
});

app.post("/api/profile/recreate", async (req, res) => {
  const profileName = String(req.body?.profileName || "default").trim() || "default";
  const result = await recreateProfile(profileName);
  if (!result.ok) {
    return res.status(500).json(result);
  }
  res.json(result);
});

app.post("/api/config/proxy/test", async (req, res) => {
  try {
    const proxy = String(req.body?.proxy || "").trim();
    const protocol = String(req.body?.protocol || "").trim();
    if (!proxy) return res.status(400).json({ error: "proxy is required" });

    const result = await testProxyConnection(proxy, protocol || undefined);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err?.message || "Proxy test failed" });
  }
});

app.get("/api/scripts", (_req, res) => {
  const files = listScriptFiles();
  res.json(files);
});

async function handleRunSync(req, res) {
  try {
    const cfg = readConfig();
    const query = req.query || {};
    const rawName = String(query.scriptName || query.script || query.name || "").trim();
    const safeName = sanitizeScriptName(rawName);
    if (!safeName) {
      return res.status(400).json({ ok: false, error: "scriptName is required" });
    }

    const filePath = path.join(SCRIPTS_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: "Script not found" });
    }
    const code = fs.readFileSync(filePath, "utf8");

    const input = {};
    for (const [key, value] of Object.entries(query)) {
      if (
        [
          "scriptName",
          "script",
          "name",
          "ephemeral",
          "includeLogs",
          "advancedFingerprintMode",
          "usePlaywrightWithFingerprints",
          "profileName"
        ].includes(key)
      )
        continue;
      input[key] = Array.isArray(value) ? value[value.length - 1] : value;
    }

    const ephemeralRaw = String(query.ephemeral || "").toLowerCase();
    const ephemeral = ephemeralRaw === "1" || ephemeralRaw === "true" || ephemeralRaw === "yes";
    const includeLogsRaw = String(query.includeLogs || "").toLowerCase();
    const includeLogs = includeLogsRaw === "1" || includeLogsRaw === "true" || includeLogsRaw === "yes";
    const advancedRaw = String(query.advancedFingerprintMode || "").toLowerCase();
    const useAdvanced = advancedRaw === "1" || advancedRaw === "true" || advancedRaw === "yes";
    const pffRaw = String(query.usePlaywrightWithFingerprints || "").toLowerCase();
    const usePff = pffRaw === "1" || pffRaw === "true" || pffRaw === "yes";
    const noProxy = isTruthy(query.noProxy);

    // Stable defaults for sync API: keep advanced mode off unless explicitly requested.
    const syncConfig = {
      ...cfg,
      profileName: String(query.profileName || cfg.profileName || "default"),
      proxy: noProxy ? "" : cfg.proxy,
      advancedFingerprintMode: useAdvanced,
      usePlaywrightWithFingerprints: usePff
    };

    let result;
    try {
      result = await executeScriptSync({
        scriptName: safeName,
        code,
        config: syncConfig,
        ephemeral,
        input
      });
    } catch (err) {
      const msg = String(err?.stack || err?.message || err || "");
      const isProfileLock =
        msg.includes("ProcessSingleton") ||
        msg.includes("profile directory is already in use") ||
        msg.includes("SingletonLock");
      if (!ephemeral && isProfileLock) {
        result = await executeScriptSync({
          scriptName: safeName,
          code,
          config: syncConfig,
          ephemeral: true,
          input
        });
        result.fallbackEphemeral = true;
        result.fallbackReason = "Profile is in use; retried with ephemeral context.";
      } else {
        throw err;
      }
    }

    if (!includeLogs) delete result.logs;
    res.json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err?.stack || err?.message || String(err)
    });
  }
}

// Synchronous script execution over GET:
// /api/run-sync?scriptName=example.js&var=foo&var2=bar
app.get("/api/run-sync", handleRunSync);
// Backward-compatible path
app.get("/api/scripts/run-sync", handleRunSync);

app.get("/api/scripts/:name", (req, res) => {
  const safeName = sanitizeScriptName(req.params.name);
  if (!safeName) return res.status(400).json({ error: "Invalid script name" });

  const filePath = path.join(SCRIPTS_DIR, safeName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Script not found" });

  const content = fs.readFileSync(filePath, "utf8");
  res.json({ name: safeName, content });
});

app.put("/api/scripts/:name", (req, res) => {
  const safeName = sanitizeScriptName(req.params.name);
  if (!safeName) return res.status(400).json({ error: "Invalid script name" });

  const content = String(req.body?.content || "");
  const filePath = path.join(SCRIPTS_DIR, safeName);
  fs.writeFileSync(filePath, content, "utf8");

  res.json({ ok: true, name: safeName });
});

app.delete("/api/scripts/:name", (req, res) => {
  const safeName = sanitizeScriptName(req.params.name);
  if (!safeName) return res.status(400).json({ error: "Invalid script name" });

  const filePath = path.join(SCRIPTS_DIR, safeName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  res.json({ ok: true });
});

app.post("/api/scripts/run", async (req, res) => {
  try {
    const cfg = readConfig();
    const body = req.body || {};
    const ephemeral = Boolean(body.ephemeral);
    const input = body.input && typeof body.input === "object" ? body.input : {};

    let scriptName = String(body.name || "").trim();
    let code = String(body.code || "");

    if (!code) {
      const safeName = sanitizeScriptName(scriptName);
      if (!safeName) return res.status(400).json({ error: "Script name is required if code is not provided" });
      const filePath = path.join(SCRIPTS_DIR, safeName);
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Script not found" });
      code = fs.readFileSync(filePath, "utf8");
      scriptName = safeName;
    } else if (!scriptName) {
      scriptName = "inline.js";
    }

    const mergedConfig = {
      ...cfg,
      ...(body.configOverride && typeof body.configOverride === "object" ? body.configOverride : {})
    };
    if (isTruthy(input.noProxy) || isTruthy(body.noProxy)) {
      mergedConfig.proxy = "";
    }

    const run = await runScript({ scriptName, code, config: mergedConfig, ephemeral, input });
    res.json({ ok: true, run: makeRunSummary(run) });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Run failed" });
  }
});

app.get("/api/runs", (_req, res) => {
  const items = runOrder
    .map((id) => runs.get(id))
    .filter(Boolean)
    .map((run) => makeRunSummary(run));
  res.json(items);
});

app.get("/api/runs/:id", (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });

  res.json({
    ...makeRunSummary(run),
    logs: run.logs
  });
});

app.post("/api/runs/clear", async (_req, res) => {
  try {
    const ids = [...runOrder];
    for (const id of ids) {
      const run = runs.get(id);
      if (run && run.status === "done" && run.keepBrowserOpenOnFinish) {
        await cleanupRunResources(run);
      }
    }
    runs.clear();
    runOrder.length = 0;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to clear runs" });
  }
});

app.post("/api/runs/:id/stop", async (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });
  if (!run.stop) return res.status(400).json({ error: "Run is not active" });

  run.stopRequested = true;
  await run.stop();
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Playwright automation runner listening on http://localhost:${port}`);
});
