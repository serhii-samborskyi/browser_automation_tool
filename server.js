import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import os from "os";
import path from "path";
import util from "util";
import { execFile } from "child_process";
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
  rotateFingerprintWithProfile: false,
  safeModeEnabled: false,
  safeModeMinFreeRamGb: 4,
  browserJobTimeoutMs: Math.max(10000, Number(process.env.BROWSER_JOB_TIMEOUT_MS) || 180000),
  camoufoxSharedIdleMs: Math.max(5000, Number(process.env.CAMOUFOX_SHARED_IDLE_MS) || 30000),
  maxConcurrentRunSlots: Math.max(
    1,
    Number(process.env.MAX_BROWSER_JOBS || process.env.MAX_CONCURRENT_RUN_SLOTS) || 20
  ),
  maxQueuedRunSlots: Math.max(1, Number(process.env.MAX_QUEUED_RUN_SLOTS) || 200)
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
      syncRunSlotLimitsFromConfig(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    const next = {
      ...DEFAULT_CONFIG,
      ...parsed,
      browserEngine: normalizeBrowserEngine(parsed?.browserEngine || DEFAULT_CONFIG.browserEngine),
      rotateProfileEveryNRequests: normalizeRotateEvery(parsed?.rotateProfileEveryNRequests),
      rotateFingerprintWithProfile: Boolean(parsed?.rotateFingerprintWithProfile),
      safeModeEnabled: Boolean(parsed?.safeModeEnabled),
      safeModeMinFreeRamGb: normalizePositiveInt(parsed?.safeModeMinFreeRamGb, DEFAULT_CONFIG.safeModeMinFreeRamGb, 1, 64),
      browserJobTimeoutMs: normalizePositiveInt(
        parsed?.browserJobTimeoutMs,
        DEFAULT_CONFIG.browserJobTimeoutMs,
        10000,
        3600000
      ),
      camoufoxSharedIdleMs: normalizePositiveInt(
        parsed?.camoufoxSharedIdleMs,
        DEFAULT_CONFIG.camoufoxSharedIdleMs,
        5000,
        3600000
      ),
      maxConcurrentRunSlots: normalizePositiveInt(
        parsed?.maxConcurrentRunSlots,
        DEFAULT_CONFIG.maxConcurrentRunSlots,
        1,
        128
      ),
      maxQueuedRunSlots: normalizePositiveInt(parsed?.maxQueuedRunSlots, DEFAULT_CONFIG.maxQueuedRunSlots, 1, 5000)
    };
    syncRunSlotLimitsFromConfig(next);
    return next;
  } catch {
    syncRunSlotLimitsFromConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  next.maxConcurrentRunSlots = normalizePositiveInt(
    next.maxConcurrentRunSlots,
    DEFAULT_CONFIG.maxConcurrentRunSlots,
    1,
    128
  );
  next.maxQueuedRunSlots = normalizePositiveInt(next.maxQueuedRunSlots, DEFAULT_CONFIG.maxQueuedRunSlots, 1, 5000);
  next.browserJobTimeoutMs = normalizePositiveInt(
    next.browserJobTimeoutMs,
    DEFAULT_CONFIG.browserJobTimeoutMs,
    10000,
    3600000
  );
  next.camoufoxSharedIdleMs = normalizePositiveInt(
    next.camoufoxSharedIdleMs,
    DEFAULT_CONFIG.camoufoxSharedIdleMs,
    5000,
    3600000
  );
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  syncRunSlotLimitsFromConfig(next);
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

function normalizePositiveInt(value, fallback, min = 1, max = 10000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
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

const runs = new Map();
const runOrder = [];
const MAX_STORED_RUNS = 60;
const MAX_RUN_LOG_LINES = 800;
const MAX_SYNC_LOG_LINES = 300;
let maxConcurrentRunSlots = DEFAULT_CONFIG.maxConcurrentRunSlots;
let maxQueuedRunSlots = DEFAULT_CONFIG.maxQueuedRunSlots;
let activeRunSlots = 0;
const runSlotQueue = [];
const activeBrowserJobs = new Map();

function syncRunSlotLimitsFromConfig(cfg) {
  maxConcurrentRunSlots = normalizePositiveInt(
    cfg?.maxConcurrentRunSlots,
    DEFAULT_CONFIG.maxConcurrentRunSlots,
    1,
    128
  );
  maxQueuedRunSlots = normalizePositiveInt(cfg?.maxQueuedRunSlots, DEFAULT_CONFIG.maxQueuedRunSlots, 1, 5000);
}

function getRunSlotStats() {
  return {
    maxConcurrentRunSlots,
    maxQueuedRunSlots,
    activeRunSlots,
    queuedRunSlots: runSlotQueue.length
  };
}

function createQueueFullError() {
  const err = new Error(
    `Server is busy: run queue is full (${maxQueuedRunSlots}). Reduce concurrency or retry shortly.`
  );
  err.code = "QUEUE_FULL";
  return err;
}

function dispatchRunSlotQueue() {
  while (activeRunSlots < maxConcurrentRunSlots && runSlotQueue.length) {
    const waiter = runSlotQueue.shift();
    if (!waiter) continue;

    activeRunSlots += 1;
    const waitedMs = Date.now() - waiter.enqueuedAt;

    waiter.resolve({
      waitedMs,
      release: () => {
        if (waiter.released) return;
        waiter.released = true;
        activeRunSlots = Math.max(0, activeRunSlots - 1);
        dispatchRunSlotQueue();
      }
    });
  }
}

async function acquireRunSlot() {
  if (activeRunSlots < maxConcurrentRunSlots) {
    activeRunSlots += 1;
    let released = false;
    return {
      waitedMs: 0,
      release: () => {
        if (released) return;
        released = true;
        activeRunSlots = Math.max(0, activeRunSlots - 1);
        dispatchRunSlotQueue();
      }
    };
  }

  if (runSlotQueue.length >= maxQueuedRunSlots) {
    throw createQueueFullError();
  }

  return await new Promise((resolve) => {
    runSlotQueue.push({
      enqueuedAt: Date.now(),
      released: false,
      resolve
    });
  });
}

function registerActiveBrowserJob(jobId, session, logFn = () => {}) {
  if (!jobId || !session) return;
  activeBrowserJobs.set(jobId, {
    session,
    startedAt: Date.now()
  });
  logFn(`[browser-job] started ${jobId}`);
}

async function closeBrowserResources(session) {
  if (!session) return;
  try {
    await session.page?.close?.().catch(() => {});
  } catch {
    // ignore
  }
  try {
    await session.context?.close?.().catch(() => {});
  } catch {
    // ignore
  }
  if (!session.isSharedCamoufoxContext) {
    try {
      await session.browser?.close?.().catch(() => {});
    } catch {
      // ignore
    }
  }
  try {
    await session.close?.().catch(() => {});
  } catch {
    // ignore
  }
}

async function unregisterActiveBrowserJob(jobId, logFn = () => {}) {
  if (!jobId) return;
  const entry = activeBrowserJobs.get(jobId);
  if (!entry) return;
  activeBrowserJobs.delete(jobId);
  logFn(`[browser-job] closed ${jobId}`);
}

async function cleanupAllActiveBrowserJobs(reason = "shutdown") {
  const entries = [...activeBrowserJobs.entries()];
  for (const [jobId, entry] of entries) {
    try {
      await closeBrowserResources(entry?.session);
      activeBrowserJobs.delete(jobId);
      console.log(`[browser-job] force-cleaned ${jobId} (${reason})`);
    } catch (err) {
      console.error(`[browser-job] force-clean failed ${jobId} (${reason})`, err?.message || err);
    }
  }
}

let shutdownInProgress = false;
async function handleProcessShutdown(reason, err = null) {
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  if (err) {
    console.error(`[${reason}]`, err);
  } else {
    console.log(`[${reason}] cleaning up active browser jobs`);
  }
  await cleanupAllActiveBrowserJobs(reason);
}

process.on("SIGINT", () => {
  void handleProcessShutdown("SIGINT").finally(() => process.exit(130));
});
process.on("SIGTERM", () => {
  void handleProcessShutdown("SIGTERM").finally(() => process.exit(143));
});
process.on("uncaughtException", (err) => {
  void handleProcessShutdown("uncaughtException", err).finally(() => process.exit(1));
});
process.on("unhandledRejection", (reason) => {
  void handleProcessShutdown("unhandledRejection", reason).finally(() => process.exit(1));
});

async function waitForSafeModeRam(runConfig, logFn = () => {}) {
  if (!Boolean(runConfig?.safeModeEnabled)) return;
  const minFreeGb = Math.max(1, Number(runConfig?.safeModeMinFreeRamGb) || DEFAULT_CONFIG.safeModeMinFreeRamGb);
  const maxWaitMs = 30000;
  const sleepMs = 2000;
  const started = Date.now();

  while (true) {
    const freeGb = Number(os.freemem() || 0) / 1024 / 1024 / 1024;
    if (freeGb >= minFreeGb) return;

    const waited = Date.now() - started;
    if (waited >= maxWaitMs) {
      const err = new Error(
        `Safe mode RAM guard: free RAM ${freeGb.toFixed(2)} GB is below minimum ${minFreeGb.toFixed(2)} GB`
      );
      err.code = "LOW_RAM";
      throw err;
    }

    logFn(
      `[safe-mode] low RAM ${freeGb.toFixed(2)} GB < ${minFreeGb.toFixed(2)} GB, waiting ${sleepMs}ms before retry`
    );
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }
}

const execFileAsync = util.promisify(execFile);
const METRICS_TTL_MS = 2000;
let metricsCache = { ts: 0, data: null, pending: null };
let previousCpuSample = null;
let previousProcCpu = process.cpuUsage();
let previousProcHr = process.hrtime.bigint();

function snapshotCpuTimes() {
  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const times = cpu?.times || {};
    const cpuIdle = Number(times.idle || 0);
    const cpuTotal =
      Number(times.user || 0) +
      Number(times.nice || 0) +
      Number(times.sys || 0) +
      Number(times.idle || 0) +
      Number(times.irq || 0);
    idle += cpuIdle;
    total += cpuTotal;
  }
  return { idle, total, cores: Math.max(1, cpus.length) };
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(digits));
}

function readCpuMetrics() {
  const nowSample = snapshotCpuTimes();
  const nowProcCpu = process.cpuUsage();
  const nowHr = process.hrtime.bigint();

  if (!previousCpuSample) {
    previousCpuSample = nowSample;
    previousProcCpu = nowProcCpu;
    previousProcHr = nowHr;
    return {
      systemPercent: 0,
      processPercent: 0,
      load1: formatNumber(os.loadavg?.()[0] || 0, 2),
      cores: nowSample.cores
    };
  }

  const deltaIdle = nowSample.idle - previousCpuSample.idle;
  const deltaTotal = nowSample.total - previousCpuSample.total;
  const systemPercent = deltaTotal > 0 ? ((deltaTotal - deltaIdle) / deltaTotal) * 100 : 0;

  const procDeltaUser = nowProcCpu.user - previousProcCpu.user;
  const procDeltaSys = nowProcCpu.system - previousProcCpu.system;
  const procDeltaUs = Math.max(0, procDeltaUser + procDeltaSys);
  const elapsedUs = Number((nowHr - previousProcHr) / 1000n);
  const processPercentOfCore = elapsedUs > 0 ? (procDeltaUs / elapsedUs) * 100 : 0;
  const processPercent = processPercentOfCore / Math.max(1, nowSample.cores);

  previousCpuSample = nowSample;
  previousProcCpu = nowProcCpu;
  previousProcHr = nowHr;

  return {
    systemPercent: formatNumber(clampPercent(systemPercent), 1),
    processPercent: formatNumber(clampPercent(processPercent), 1),
    load1: formatNumber(os.loadavg?.()[0] || 0, 2),
    cores: nowSample.cores
  };
}

function readRamMetrics() {
  const totalBytes = Number(os.totalmem() || 0);
  const freeBytes = Number(os.freemem() || 0);
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
  const proc = process.memoryUsage();
  return {
    totalBytes,
    usedBytes,
    freeBytes,
    usedPercent: formatNumber(clampPercent(usedPercent), 1),
    processRssBytes: Number(proc?.rss || 0),
    processHeapUsedBytes: Number(proc?.heapUsed || 0)
  };
}

async function readDiskMetrics() {
  try {
    const { stdout } = await execFileAsync("df", ["-kP", "/"]);
    const lines = String(stdout || "")
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    if (lines.length < 2) return null;
    const parts = lines[1].trim().split(/\s+/);
    if (parts.length < 6) return null;
    const totalBytes = Number(parts[1]) * 1024;
    const usedBytes = Number(parts[2]) * 1024;
    const availableBytes = Number(parts[3]) * 1024;
    const usedPercent = Number(String(parts[4] || "").replace("%", ""));
    return {
      path: "/",
      totalBytes: Number.isFinite(totalBytes) ? totalBytes : 0,
      usedBytes: Number.isFinite(usedBytes) ? usedBytes : 0,
      availableBytes: Number.isFinite(availableBytes) ? availableBytes : 0,
      usedPercent: formatNumber(clampPercent(usedPercent), 1)
    };
  } catch {
    return null;
  }
}

async function readGpuMetrics() {
  try {
    const { stdout } = await execFileAsync("nvidia-smi", [
      "--query-gpu=utilization.gpu,memory.used,memory.total",
      "--format=csv,noheader,nounits"
    ]);
    const rows = String(stdout || "")
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(",").map((v) => Number(v.trim())));
    if (!rows.length) return { available: false, source: "nvidia-smi", reason: "No GPU rows" };

    const gpuCount = rows.length;
    const utilAvg =
      rows.reduce((sum, row) => sum + (Number.isFinite(row[0]) ? row[0] : 0), 0) / Math.max(1, gpuCount);
    const memoryUsedMiB = rows.reduce((sum, row) => sum + (Number.isFinite(row[1]) ? row[1] : 0), 0);
    const memoryTotalMiB = rows.reduce((sum, row) => sum + (Number.isFinite(row[2]) ? row[2] : 0), 0);
    const memoryUsedPercent = memoryTotalMiB > 0 ? (memoryUsedMiB / memoryTotalMiB) * 100 : 0;

    return {
      available: true,
      source: "nvidia-smi",
      gpuCount,
      utilizationPercent: formatNumber(clampPercent(utilAvg), 1),
      memoryUsedMiB: formatNumber(memoryUsedMiB, 1),
      memoryTotalMiB: formatNumber(memoryTotalMiB, 1),
      memoryUsedPercent: formatNumber(clampPercent(memoryUsedPercent), 1)
    };
  } catch {
    return { available: false, source: "nvidia-smi", reason: "nvidia-smi unavailable" };
  }
}

async function collectServerMetrics() {
  const [disk, gpu] = await Promise.all([readDiskMetrics(), readGpuMetrics()]);
  return {
    now: new Date().toISOString(),
    runs: getRunSlotStats(),
    processes: {
      active: activeRunSlots,
      queued: runSlotQueue.length
    },
    cpu: readCpuMetrics(),
    ram: readRamMetrics(),
    disk,
    gpu
  };
}

async function getServerMetricsCached() {
  const now = Date.now();
  if (metricsCache.data && now - metricsCache.ts < METRICS_TTL_MS) {
    return metricsCache.data;
  }
  if (metricsCache.pending) {
    return await metricsCache.pending;
  }
  metricsCache.pending = (async () => {
    const data = await collectServerMetrics();
    metricsCache = { ts: Date.now(), data, pending: null };
    return data;
  })();
  try {
    return await metricsCache.pending;
  } finally {
    if (metricsCache.pending) {
      metricsCache.pending = null;
    }
  }
}

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
    requestedEphemeral: Boolean(run.requestedEphemeral),
    fallbackEphemeral: Boolean(run.fallbackEphemeral),
    fallbackReason: run.fallbackReason || null,
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

function buildLaunchSessionOptions(runConfig, ephemeral) {
  return {
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
    safeModeEnabled: Boolean(runConfig.safeModeEnabled),
    safeModeSharedBrowserIdleMs: Number(runConfig.camoufoxSharedIdleMs) || DEFAULT_CONFIG.camoufoxSharedIdleMs,
    ephemeral: Boolean(ephemeral)
  };
}

function shouldRetryEphemeralLaunch(err) {
  const msg = String(err?.stack || err?.message || err || "");
  const low = msg.toLowerCase();
  return (
    msg.includes("ProcessSingleton") ||
    msg.includes("profile directory is already in use") ||
    msg.includes("SingletonLock") ||
    (low.includes("launchpersistentcontext") && low.includes("target page, context or browser has been closed")) ||
    (low.includes("camoufox") && low.includes("target page, context or browser has been closed"))
  );
}

function compactLaunchError(err) {
  const text = String(err?.message || err || "");
  const first = text.split("\n").find((line) => String(line || "").trim()) || text;
  return first.trim();
}

async function launchSessionWithFallback(runConfig, ephemeral, logFn = () => {}) {
  try {
    const session = await launchBrowserSession(buildLaunchSessionOptions(runConfig, ephemeral));
    return { session, effectiveEphemeral: Boolean(ephemeral), fallbackEphemeral: false, fallbackReason: null };
  } catch (err) {
    if (Boolean(ephemeral) || !shouldRetryEphemeralLaunch(err)) throw err;
    logFn(`[launch] persistent profile failed, retrying ephemeral: ${compactLaunchError(err)}`);
    const session = await launchBrowserSession(buildLaunchSessionOptions(runConfig, true));
    return {
      session,
      effectiveEphemeral: true,
      fallbackEphemeral: true,
      fallbackReason: "Persistent profile launch failed; retried with ephemeral context."
    };
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
        const cacheHitMarker = String(headers["x-ai-cache"] || "").toLowerCase();
        if (cacheHitMarker === "hit") return;
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

async function runBrowserJob({
  jobId,
  scriptName,
  code,
  config,
  ephemeral,
  input = {},
  logFn = () => {},
  stopRequested = () => false
}) {
  let session = null;
  let slot = null;
  let trafficMeter = null;
  let explicitResult;
  let runConfig = { ...config };
  let effectiveEphemeral = Boolean(ephemeral);
  let fallbackEphemeral = false;
  let fallbackReason = null;
  let softTimeoutId = null;
  let hardTimeoutId = null;
  const browserJobTimeoutMs = Math.max(10000, Number(runConfig.browserJobTimeoutMs) || DEFAULT_CONFIG.browserJobTimeoutMs);

  const setResult = (value) => {
    explicitResult = value;
  };

  try {
    await waitForSafeModeRam(runConfig, (...args) => logFn(...args));
    slot = await acquireRunSlot();
    if (slot.waitedMs > 0) {
      logFn(`[queue] waited ${slot.waitedMs}ms for available run slot`);
    }

    const rotation = await maybeRotateProfileAndFingerprint(runConfig, (...args) => logFn(...args));
    runConfig = rotation?.config || runConfig;

    const launched = await launchSessionWithFallback(runConfig, ephemeral, (...args) => logFn(...args));
    session = launched.session;
    effectiveEphemeral = launched.effectiveEphemeral;
    fallbackEphemeral = launched.fallbackEphemeral;
    fallbackReason = launched.fallbackReason;

    registerActiveBrowserJob(jobId, session, (...args) => logFn(...args));

    trafficMeter = await createTrafficMeter(session.page, Boolean(runConfig.measureTrafficUsage), (...args) => logFn(...args));

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
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

    const softTimeoutMs = Number(runConfig.timeoutMs) || DEFAULT_CONFIG.timeoutMs;
    const softTimeoutPromise = new Promise((_, reject) => {
      softTimeoutId = setTimeout(() => {
        reject(new Error(`Script timed out after ${softTimeoutMs}ms`));
      }, softTimeoutMs);
    });

    const hardTimeoutPromise = new Promise((_, reject) => {
      hardTimeoutId = setTimeout(() => {
        reject(new Error(`Browser job hard timeout after ${browserJobTimeoutMs}ms`));
      }, browserJobTimeoutMs);
    });

    const returned = await Promise.race([
      fn(
        session.page,
        session.context,
        session.browser,
        playwright,
        (...args) => logFn(...args),
        sleep,
        { ...runConfig, ephemeral: Boolean(effectiveEphemeral) },
        stopRequested,
        input,
        setResult
      ),
      softTimeoutPromise,
      hardTimeoutPromise
    ]);

    const traffic = trafficMeter.getStats();
    return {
      returned,
      explicitResult,
      traffic,
      effectiveEphemeral,
      fallbackEphemeral,
      fallbackReason,
      runConfig
    };
  } catch (err) {
    if (String(err?.message || "").includes("hard timeout")) {
      logFn(`[browser-job] timeout ${jobId}: ${err?.message || err}`);
    }
    throw err;
  } finally {
    if (softTimeoutId) clearTimeout(softTimeoutId);
    if (hardTimeoutId) clearTimeout(hardTimeoutId);
    try {
      await trafficMeter?.stop?.();
    } catch {
      // ignore
    }
    await closeBrowserResources(session);
    await unregisterActiveBrowserJob(jobId, (...args) => logFn(...args));
    try {
      slot?.release?.();
    } catch {
      // ignore
    }
  }
}

async function executeScriptSync({ scriptName, code, config, ephemeral, input = {} }) {
  const started = Date.now();
  const logs = [];

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

  const browserJob = await runBrowserJob({
    jobId: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scriptName,
    code,
    config,
    ephemeral,
    input,
    logFn: (...args) => pushLog(...args),
    stopRequested: () => false
  });

  const out = {
    ok: true,
    scriptName,
    durationMs: Date.now() - started,
    result: browserJob.explicitResult !== undefined ? browserJob.explicitResult : browserJob.returned ?? null,
    traffic: browserJob.traffic,
    logs
  };
  if (browserJob.fallbackEphemeral) {
    out.fallbackEphemeral = true;
    out.fallbackReason = browserJob.fallbackReason;
  }
  return out;
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
    requestedEphemeral: Boolean(ephemeral),
    fallbackEphemeral: false,
    fallbackReason: null,
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
    try {
      run.status = "running";
      addRunLog(run, `[run] starting script ${scriptName}`);
      run.stop = async () => {
        run.stopRequested = true;
      };

      const stopRequested = () => run.stopRequested;
      const browserJob = await runBrowserJob({
        jobId: runId,
        scriptName,
        code,
        config,
        ephemeral,
        input,
        logFn: (...args) => addRunLog(run, ...args),
        stopRequested
      });

      run.ephemeral = browserJob.effectiveEphemeral;
      run.fallbackEphemeral = browserJob.fallbackEphemeral;
      run.fallbackReason = browserJob.fallbackReason;

      if (run.stopRequested) {
        run.status = "stopped";
        addRunLog(run, "[run] stopped");
      } else {
        run.status = "done";
        addRunLog(run, "[run] completed");
        if (browserJob.explicitResult !== undefined) {
          addRunLog(run, "[run] result", browserJob.explicitResult);
        }
      }
      run.traffic = browserJob.traffic;
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
      run.finishedAt = new Date().toISOString();
      run.stop = null;
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
syncRunSlotLimitsFromConfig(readConfig());

app.use(bodyParser.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString(), ...getRunSlotStats() });
});

app.get("/api/metrics", async (_req, res) => {
  try {
    const metrics = await getServerMetricsCached();
    res.json({ ok: true, ...metrics });
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to collect metrics" });
  }
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
    rotateFingerprintWithProfile: Boolean(body.rotateFingerprintWithProfile),
    safeModeEnabled: Boolean(body.safeModeEnabled),
    safeModeMinFreeRamGb: normalizePositiveInt(
      body.safeModeMinFreeRamGb,
      DEFAULT_CONFIG.safeModeMinFreeRamGb,
      1,
      64
    ),
    browserJobTimeoutMs: normalizePositiveInt(
      body.browserJobTimeoutMs,
      DEFAULT_CONFIG.browserJobTimeoutMs,
      10000,
      3600000
    ),
    camoufoxSharedIdleMs: normalizePositiveInt(
      body.camoufoxSharedIdleMs,
      DEFAULT_CONFIG.camoufoxSharedIdleMs,
      5000,
      3600000
    ),
    maxConcurrentRunSlots: normalizePositiveInt(
      body.maxConcurrentRunSlots,
      DEFAULT_CONFIG.maxConcurrentRunSlots,
      1,
      128
    ),
    maxQueuedRunSlots: normalizePositiveInt(body.maxQueuedRunSlots, DEFAULT_CONFIG.maxQueuedRunSlots, 1, 5000)
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
    if (err?.code === "QUEUE_FULL") {
      return res.status(503).set("Retry-After", "3").json({
        ok: false,
        error: err?.message || "Server is busy",
        ...getRunSlotStats()
      });
    }
    if (err?.code === "LOW_RAM") {
      return res.status(503).set("Retry-After", "5").json({
        ok: false,
        error: err?.message || "Safe mode RAM guard blocked run",
        ...getRunSlotStats()
      });
    }
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
