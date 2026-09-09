import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { getPrisma } from "./database.js";
import { PROFILE_ROOT, STANDARD_FINGERPRINT_PRESETS, sanitizeScriptName } from "./browser_setup.js";

const HOUR_MS = 60 * 60 * 1000;
const MAX_PROXY_VALUE_LENGTH = 2048;
const MAX_PROXY_POOL_IMPORT = 10000;
const MAX_INPUT_FIELDS = 100;
const MAX_API_ERROR_LENGTH = 4000;
const apiSlots = new Map();

export class ApiPlatformError extends Error {
  constructor(message, { status = 400, code = "API_PLATFORM_ERROR", retryAfterSeconds = null } = {}) {
    super(message);
    this.name = "ApiPlatformError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function toPositiveInt(value, fallback, min = 1, max = 100000) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toOptionalString(value, max = 1000) {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

function normalizeSlug(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!slug) {
    throw new ApiPlatformError("API slug must contain letters or numbers.", { code: "INVALID_API_SLUG" });
  }
  return slug;
}

function normalizeTargetDomain(value) {
  let raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    throw new ApiPlatformError("Target domain is required for proxy rate limiting.", { code: "TARGET_DOMAIN_REQUIRED" });
  }
  if (!raw.includes("://")) raw = `https://${raw}`;
  try {
    const hostname = new URL(raw).hostname.toLowerCase();
    if (!hostname) throw new Error("No hostname");
    return hostname;
  } catch {
    throw new ApiPlatformError("Target domain must be a valid hostname, for example google.com.", {
      code: "INVALID_TARGET_DOMAIN"
    });
  }
}

function normalizeProfileMode(value) {
  const mode = String(value || "DISPOSABLE").trim().toUpperCase();
  if (["DISPOSABLE", "STATIC", "AUTO"].includes(mode)) return mode;
  throw new ApiPlatformError("Profile mode must be DISPOSABLE, STATIC, or AUTO.", { code: "INVALID_PROFILE_MODE" });
}

function normalizeBrowserEngine(value) {
  const engine = String(value || "chromium").trim().toLowerCase();
  return engine === "chrome" || engine === "camoufox" ? engine : "chromium";
}

function normalizeProxyPoolType(value) {
  const type = String(value || "STATIC").trim().toUpperCase();
  if (type === "STATIC" || type === "DYNAMIC") return type;
  throw new ApiPlatformError("Proxy pool type must be STATIC or DYNAMIC.", { code: "INVALID_PROXY_POOL_TYPE" });
}

function parseInputSchema(value) {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new ApiPlatformError("Input schema must be valid JSON.", { code: "INVALID_INPUT_SCHEMA" });
    }
  }
  if (raw === undefined || raw === null || raw === "") return [];
  if (!Array.isArray(raw) || raw.length > MAX_INPUT_FIELDS) {
    throw new ApiPlatformError(`Input schema must be an array with at most ${MAX_INPUT_FIELDS} fields.`, {
      code: "INVALID_INPUT_SCHEMA"
    });
  }

  const names = new Set();
  return raw.map((field) => {
    const name = String(field?.name || "").trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || names.has(name)) {
      throw new ApiPlatformError("Each input field needs a unique variable-style name.", {
        code: "INVALID_INPUT_SCHEMA"
      });
    }
    names.add(name);
    const type = String(field?.type || "string").trim().toLowerCase();
    if (!["string", "number", "boolean", "json"].includes(type)) {
      throw new ApiPlatformError(`Unsupported input type for ${name}.`, { code: "INVALID_INPUT_SCHEMA" });
    }
    return {
      name,
      type,
      required: Boolean(field?.required),
      default: field?.default ?? null,
      description: String(field?.description || "").trim().slice(0, 500)
    };
  });
}

function coerceInput(value, type, fieldName) {
  if (type === "string") return String(value);
  if (type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new ApiPlatformError(`Input.${fieldName} must be a number.`, { code: "INVALID_API_INPUT" });
    }
    return number;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    const text = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(text)) return true;
    if (["0", "false", "no", "off"].includes(text)) return false;
    throw new ApiPlatformError(`Input.${fieldName} must be a boolean.`, { code: "INVALID_API_INPUT" });
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new ApiPlatformError(`Input.${fieldName} must be JSON.`, { code: "INVALID_API_INPUT" });
    }
  }
  return value;
}

export function validateApiInput(schema, incoming) {
  const source = incoming && typeof incoming === "object" && !Array.isArray(incoming) ? incoming : {};
  const result = { ...source };
  for (const field of Array.isArray(schema) ? schema : []) {
    const supplied = source[field.name];
    const value = supplied === undefined || supplied === "" ? field.default : supplied;
    if ((value === null || value === undefined || value === "") && field.required) {
      throw new ApiPlatformError(`Missing required input.${field.name}.`, { code: "MISSING_API_INPUT" });
    }
    if (value !== null && value !== undefined && value !== "") {
      result[field.name] = coerceInput(value, field.type, field.name);
    }
  }
  return result;
}

function normalizeProxyValue(value) {
  let raw = String(value || "").trim();
  if (!raw || raw.length > MAX_PROXY_VALUE_LENGTH) {
    throw new ApiPlatformError("Invalid proxy value.", { code: "INVALID_PROXY" });
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `http://${raw}`;
  try {
    const url = new URL(raw);
    let protocol = url.protocol.toLowerCase();
    if (protocol === "https:") protocol = "http:";
    if (protocol !== "http:" && protocol !== "socks5:") {
      throw new Error("Unsupported protocol");
    }
    if (!url.hostname || !url.port) throw new Error("Host and port are required");
    const auth = url.username
      ? `${url.username}${url.password ? `:${url.password}` : ""}@`
      : "";
    return {
      value: `${protocol}//${auth}${url.hostname}:${url.port}`,
      protocol: protocol === "socks5:" ? "socks5" : "http"
    };
  } catch {
    throw new ApiPlatformError(
      "Invalid proxy format. Use host:port, user:pass@host:port, http://..., or socks5://...",
      { code: "INVALID_PROXY" }
    );
  }
}

function parseProxyText(value) {
  const unique = new Map();
  for (const line of String(value || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parsed = normalizeProxyValue(trimmed);
    unique.set(parsed.value, parsed);
    if (unique.size > MAX_PROXY_POOL_IMPORT) {
      throw new ApiPlatformError(`A single upload is limited to ${MAX_PROXY_POOL_IMPORT} proxies.`, {
        code: "PROXY_IMPORT_TOO_LARGE"
      });
    }
  }
  return [...unique.values()];
}

function compactError(error) {
  return String(error?.message || error || "Unknown browser error").replace(/\s+/g, " ").slice(0, MAX_API_ERROR_LENGTH);
}

function jsonValue(value) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  try {
    const cloned = JSON.parse(JSON.stringify(value));
    return cloned === null ? Prisma.JsonNull : cloned;
  } catch {
    return { value: String(value) };
  }
}

function publicProxy(proxy, usage = null) {
  const now = Date.now();
  const cooling = usage?.cooldownUntil && new Date(usage.cooldownUntil).getTime() > now;
  return {
    id: proxy.id,
    poolId: proxy.poolId,
    value: proxy.value,
    label: proxy.label,
    protocol: proxy.protocol,
    enabled: proxy.enabled,
    createdAt: proxy.createdAt,
    health: usage
      ? {
          requestCount: usage.requestCount,
          totalRequestCount: usage.totalRequestCount,
          totalFailureCount: usage.totalFailureCount,
          consecutiveFailures: usage.consecutiveFailures,
          cooldownUntil: usage.cooldownUntil,
          cooling,
          lastOutcome: usage.lastOutcome,
          lastError: usage.lastError,
          lastStatusCode: usage.lastStatusCode,
          lastUsedAt: usage.lastUsedAt
        }
      : null
  };
}

function profileSnapshot(profile) {
  return {
    id: profile.id,
    name: profile.name,
    profileDir: profile.profileDir,
    type: profile.type,
    apiId: profile.apiId,
    proxyId: profile.proxyId,
    browserEngine: profile.browserEngine,
    userAgent: profile.userAgent,
    viewportWidth: profile.viewportWidth,
    viewportHeight: profile.viewportHeight,
    locale: profile.locale,
    timezoneId: profile.timezoneId,
    fingerprintPresetId: profile.fingerprintPresetId,
    enabled: profile.enabled,
    locked: profile.locked,
    lockedAt: profile.lockedAt,
    requestCount: profile.requestCount,
    maxRequests: profile.maxRequests,
    expiresAt: profile.expiresAt,
    lastUsedAt: profile.lastUsedAt,
    proxy: profile.proxy
      ? { id: profile.proxy.id, value: profile.proxy.value, label: profile.proxy.label, poolId: profile.proxy.poolId }
      : null
  };
}

function apiSnapshot(api) {
  const now = Date.now();
  const poolLinks = (api.proxyPools || []).map((link) => {
    const proxies = link.pool?.proxies || [];
    const usageMap = new Map(
      (api.proxyUsages || [])
        .filter((usage) => usage.targetDomain === api.targetDomain)
        .map((usage) => [usage.proxyId, usage])
    );
    const hourlyCapacity = proxies.filter((proxy) => proxy.enabled).length * link.requestsPerHour;
    const usedThisHour = proxies.reduce((total, proxy) => {
      const usage = usageMap.get(proxy.id);
      const inCurrentWindow = usage && now - new Date(usage.windowStartedAt).getTime() < HOUR_MS;
      return total + (inCurrentWindow ? Number(usage.requestCount || 0) : 0);
    }, 0);
    return {
      poolId: link.poolId,
      name: link.pool?.name || "Unknown pool",
      type: link.pool?.type || "STATIC",
      enabled: link.enabled,
      requestsPerHour: link.requestsPerHour,
      cooldownMinutes: link.cooldownMinutes,
      maxConsecutiveFailures: link.maxConsecutiveFailures,
      proxyCount: proxies.length,
      hourlyCapacity,
      usedThisHour
    };
  });
  const hourlyCapacity = poolLinks.filter((link) => link.enabled).reduce((sum, link) => sum + link.hourlyCapacity, 0);
  const usedThisHour = poolLinks.filter((link) => link.enabled).reduce((sum, link) => sum + link.usedThisHour, 0);
  return {
    id: api.id,
    name: api.name,
    slug: api.slug,
    scriptName: api.scriptName,
    targetDomain: api.targetDomain,
    inputSchema: api.inputSchema,
    enabled: api.enabled,
    maxConcurrentRuns: api.maxConcurrentRuns,
    maxQueuedRequests: api.maxQueuedRequests,
    profileMode: api.profileMode,
    disposableProfileMaxRequests: api.disposableProfileMaxRequests,
    disposableProfileRetentionMinutes: api.disposableProfileRetentionMinutes,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
    proxyPools: poolLinks,
    staticProfiles: (api.profileLinks || []).map((link) => profileSnapshot(link.profile)),
    hourlyCapacity,
    usedThisHour,
    ratePerMinute: Number((hourlyCapacity / 60).toFixed(2)),
    ratePerSecond: Number((hourlyCapacity / 3600).toFixed(4))
  };
}

async function getApiWithRelations(idOrSlug, bySlug = false) {
  const db = getPrisma();
  const api = await db.api.findUnique({
    where: bySlug ? { slug: idOrSlug } : { id: idOrSlug },
    include: {
      proxyPools: {
        include: {
          pool: { include: { proxies: { where: { enabled: true } } } }
        }
      },
      profileLinks: { include: { profile: { include: { proxy: true } } } },
      proxyUsages: true
    }
  });
  if (!api) throw new ApiPlatformError("API not found.", { status: 404, code: "API_NOT_FOUND" });
  return api;
}

// pg_advisory_xact_lock() returns PostgreSQL's `void` type. Prisma cannot
// deserialize that type when it is returned directly by $queryRaw, so return a
// normal boolean from a CTE after the transaction-scoped lock has been taken.
async function acquireUsageLock(tx, lockKey) {
  const rows = await tx.$queryRaw`
    WITH advisory_lock AS (
      SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
    )
    SELECT TRUE AS locked FROM advisory_lock
  `;
  if (!rows?.[0]?.locked) {
    throw new ApiPlatformError("Could not acquire the proxy usage lock.", {
      status: 503,
      code: "PROXY_USAGE_LOCK_FAILED",
      retryAfterSeconds: 1
    });
  }
}

function getApiSlotState(apiId) {
  let state = apiSlots.get(apiId);
  if (!state) {
    state = { active: 0, queue: [] };
    apiSlots.set(apiId, state);
  }
  return state;
}

function dispatchApiQueue(state, maxConcurrent) {
  while (state.active < maxConcurrent && state.queue.length) {
    const item = state.queue.shift();
    if (!item) continue;
    state.active += 1;
    item.resolve(createApiSlotRelease(state, maxConcurrent));
  }
}

function createApiSlotRelease(state, maxConcurrent) {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.active = Math.max(0, state.active - 1);
    dispatchApiQueue(state, maxConcurrent);
  };
}

async function acquireApiSlot(api) {
  const state = getApiSlotState(api.id);
  const maxConcurrent = toPositiveInt(api.maxConcurrentRuns, 1, 1, 128);
  if (state.active < maxConcurrent) {
    state.active += 1;
    return createApiSlotRelease(state, maxConcurrent);
  }
  if (state.queue.length >= toPositiveInt(api.maxQueuedRequests, 100, 0, 10000)) {
    throw new ApiPlatformError("API request queue is full. Retry shortly.", {
      status: 429,
      code: "API_QUEUE_FULL",
      retryAfterSeconds: 3
    });
  }
  return await new Promise((resolve) => state.queue.push({ resolve }));
}

async function removeProfileDirectory(profileDir) {
  const safeDir = String(profileDir || "");
  if (!safeDir || safeDir !== path.basename(safeDir) || safeDir === "." || safeDir === "..") return;
  await fsp.rm(path.join(PROFILE_ROOT, safeDir), { recursive: true, force: true });
}

async function cleanupExpiredDisposableProfiles(apiId) {
  const db = getPrisma();
  const now = new Date();
  const expired = await db.browserProfile.findMany({
    where: {
      apiId,
      type: "DISPOSABLE",
      locked: false,
      expiresAt: { lte: now }
    }
  });
  for (const profile of expired) {
    await removeProfileDirectory(profile.profileDir).catch(() => {});
    await db.browserProfile.delete({ where: { id: profile.id } }).catch(() => {});
  }
}

async function clearStaleProfileLocks(timeoutMs) {
  const db = getPrisma();
  // A profile lock is only acquired after the global browser slot is reserved.
  // Keep a conservative recovery window for abrupt process crashes.
  const staleAt = new Date(Date.now() - Math.max(60 * 60 * 1000, Number(timeoutMs || 0) + 5 * 60 * 1000));
  await db.browserProfile.updateMany({
    where: { locked: true, lockedAt: { lte: staleAt } },
    data: { locked: false, lockedAt: null }
  });
}

async function lockProfile(profileId) {
  const db = getPrisma();
  const updated = await db.browserProfile.updateMany({
    where: { id: profileId, locked: false, enabled: true },
    data: { locked: true, lockedAt: new Date() }
  });
  if (!updated.count) return null;
  return await db.browserProfile.findUnique({ where: { id: profileId }, include: { proxy: true } });
}

async function releaseProfile(profile, { finished = true } = {}) {
  if (!profile) return;
  const db = getPrisma();
  const now = new Date();
  if (profile.type === "STATIC") {
    await db.browserProfile.update({
      where: { id: profile.id },
      data: {
        locked: false,
        lockedAt: null,
        lastUsedAt: now,
        requestCount: finished ? { increment: 1 } : undefined
      }
    }).catch(() => {});
    return;
  }

  const nextCount = Number(profile.requestCount || 0) + (finished ? 1 : 0);
  const shouldDelete = finished && nextCount >= Number(profile.maxRequests || 1);
  if (shouldDelete) {
    await db.browserProfile.delete({ where: { id: profile.id } }).catch(() => {});
    await removeProfileDirectory(profile.profileDir).catch(() => {});
    return;
  }
  await db.browserProfile.update({
    where: { id: profile.id },
    data: {
      locked: false,
      lockedAt: null,
      lastUsedAt: now,
      requestCount: finished ? { increment: 1 } : undefined
    }
  }).catch(() => {});
}

async function findAndLockStaticProfile(api) {
  const db = getPrisma();
  const candidates = await db.browserProfile.findMany({
    where: {
      type: "STATIC",
      enabled: true,
      locked: false,
      proxyId: { not: null },
      apiLinks: { some: { apiId: api.id } }
    },
    include: { proxy: true },
    orderBy: [{ lastUsedAt: "asc" }, { createdAt: "asc" }]
  });
  for (const candidate of candidates) {
    const locked = await lockProfile(candidate.id);
    if (locked) return locked;
  }
  return null;
}

async function findAndLockDisposableProfile(api) {
  const db = getPrisma();
  await cleanupExpiredDisposableProfiles(api.id);
  const now = new Date();
  const candidates = await db.browserProfile.findMany({
    where: {
      apiId: api.id,
      type: "DISPOSABLE",
      enabled: true,
      locked: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    include: { proxy: true },
    orderBy: [{ lastUsedAt: "asc" }, { createdAt: "asc" }]
  });
  for (const candidate of candidates) {
    if (candidate.requestCount >= candidate.maxRequests || !candidate.proxyId) continue;
    const locked = await lockProfile(candidate.id);
    if (locked) return locked;
  }
  return null;
}

function findFingerprintPreset(id) {
  return STANDARD_FINGERPRINT_PRESETS.find((preset) => preset.id === id) || null;
}

function randomFingerprintPreset() {
  if (!STANDARD_FINGERPRINT_PRESETS.length) return null;
  return STANDARD_FINGERPRINT_PRESETS[Math.floor(Math.random() * STANDARD_FINGERPRINT_PRESETS.length)] || null;
}

function nextDisposableName(apiSlug) {
  const random = Math.random().toString(36).slice(2, 10);
  return `api-${apiSlug}-${Date.now().toString(36)}-${random}`.slice(0, 120);
}

async function createDisposableProfile(api, proxy, baseConfig) {
  const db = getPrisma();
  const preset = randomFingerprintPreset();
  const profileDir = nextDisposableName(api.slug);
  const retentionMinutes = toPositiveInt(api.disposableProfileRetentionMinutes, 0, 0, 43200);
  const expiresAt = retentionMinutes > 0 ? new Date(Date.now() + retentionMinutes * 60 * 1000) : null;
  return await db.browserProfile.create({
    data: {
      name: profileDir,
      profileDir,
      type: "DISPOSABLE",
      apiId: api.id,
      proxyId: proxy.id,
      browserEngine: normalizeBrowserEngine(baseConfig.browserEngine),
      userAgent: preset?.userAgent || baseConfig.userAgent || null,
      viewportWidth: Number(preset?.viewportWidth || baseConfig.viewportWidth) || 1440,
      viewportHeight: Number(preset?.viewportHeight || baseConfig.viewportHeight) || 900,
      locale: preset?.locale || baseConfig.locale || "en-US",
      timezoneId: preset?.timezoneId || baseConfig.timezoneId || "America/Chicago",
      fingerprintPresetId: preset?.id || null,
      locked: true,
      lockedAt: new Date(),
      maxRequests: toPositiveInt(api.disposableProfileMaxRequests, 1, 1, 100000),
      expiresAt
    },
    include: { proxy: true }
  });
}

async function claimProxyForApi(api, preferredProxyId = null) {
  const db = getPrisma();
  const now = new Date();
  const targetDomain = api.targetDomain;
  const links = (api.proxyPools || []).filter((link) => link.enabled && link.pool);
  const candidates = [];
  for (const link of links) {
    for (const proxy of link.pool.proxies || []) {
      if (!proxy.enabled || (preferredProxyId && proxy.id !== preferredProxyId)) continue;
      candidates.push({ link, proxy });
    }
  }
  if (!candidates.length) {
    throw new ApiPlatformError("No active proxy from an assigned proxy pool is available for this API.", {
      status: 429,
      code: "NO_ASSIGNED_PROXIES",
      retryAfterSeconds: 30
    });
  }

  const usages = await db.proxyUsage.findMany({
    where: { apiId: api.id, targetDomain, proxyId: { in: candidates.map((candidate) => candidate.proxy.id) } }
  });
  const usageByProxy = new Map(usages.map((usage) => [usage.proxyId, usage]));
  const retryAfter = [];

  candidates.sort((a, b) => {
    const aUsage = usageByProxy.get(a.proxy.id);
    const bUsage = usageByProxy.get(b.proxy.id);
    const aCount = aUsage && now - new Date(aUsage.windowStartedAt) < HOUR_MS ? aUsage.requestCount : 0;
    const bCount = bUsage && now - new Date(bUsage.windowStartedAt) < HOUR_MS ? bUsage.requestCount : 0;
    if (aCount !== bCount) return aCount - bCount;
    return Number(new Date(aUsage?.lastUsedAt || 0)) - Number(new Date(bUsage?.lastUsedAt || 0));
  });

  for (const candidate of candidates) {
    const cached = usageByProxy.get(candidate.proxy.id);
    if (cached?.cooldownUntil && new Date(cached.cooldownUntil) > now) {
      retryAfter.push(Math.ceil((new Date(cached.cooldownUntil).getTime() - now.getTime()) / 1000));
      continue;
    }
    if (cached && now.getTime() - new Date(cached.windowStartedAt).getTime() < HOUR_MS && cached.requestCount >= candidate.link.requestsPerHour) {
      retryAfter.push(Math.ceil((new Date(cached.windowStartedAt).getTime() + HOUR_MS - now.getTime()) / 1000));
      continue;
    }

    const claimed = await db.$transaction(async (tx) => {
      const lockKey = `proxy-usage:${api.id}:${candidate.proxy.id}:${targetDomain}`;
      await acquireUsageLock(tx, lockKey);
      let usage = await tx.proxyUsage.upsert({
        where: {
          apiId_proxyId_targetDomain: {
            apiId: api.id,
            proxyId: candidate.proxy.id,
            targetDomain
          }
        },
        create: { apiId: api.id, proxyId: candidate.proxy.id, targetDomain },
        update: {}
      });
      const currentNow = new Date();
      if (currentNow.getTime() - new Date(usage.windowStartedAt).getTime() >= HOUR_MS) {
        usage = await tx.proxyUsage.update({
          where: { id: usage.id },
          data: { windowStartedAt: currentNow, requestCount: 0, cooldownUntil: null }
        });
      }
      if (usage.cooldownUntil && new Date(usage.cooldownUntil) > currentNow) return null;
      if (usage.requestCount >= candidate.link.requestsPerHour) return null;
      const updated = await tx.proxyUsage.update({
        where: { id: usage.id },
        data: {
          requestCount: { increment: 1 },
          totalRequestCount: { increment: 1 },
          lastUsedAt: currentNow
        }
      });
      return updated;
    });

    if (claimed) {
      return { ...candidate, pool: candidate.link.pool, usage: claimed, targetDomain };
    }
  }

  const next = retryAfter.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b)[0] || 30;
  throw new ApiPlatformError("All assigned proxies are rate-limited or temporarily cooling down.", {
    status: 429,
    code: "PROXY_CAPACITY_EXHAUSTED",
    retryAfterSeconds: next
  });
}

function rateLimitError(error) {
  return /\b429\b|too many requests|rate.?limit|captcha|unusual traffic/i.test(String(error || ""));
}

async function recordProxyOutcome(lease, { ok, error = null, statusCode = null } = {}) {
  if (!lease) return;
  const db = getPrisma();
  const now = new Date();
  await db.$transaction(async (tx) => {
    const lockKey = `proxy-usage:${lease.link.apiId}:${lease.proxy.id}:${lease.targetDomain}`;
    await acquireUsageLock(tx, lockKey);
    const usage = await tx.proxyUsage.findUnique({
      where: {
        apiId_proxyId_targetDomain: {
          apiId: lease.link.apiId,
          proxyId: lease.proxy.id,
          targetDomain: lease.targetDomain
        }
      }
    });
    if (!usage) return;

    if (ok) {
      await tx.proxyUsage.update({
        where: { id: usage.id },
        data: {
          consecutiveFailures: 0,
          cooldownUntil: null,
          lastOutcome: "SUCCESS",
          lastError: null,
          lastStatusCode: statusCode,
          lastUsedAt: now
        }
      });
      return;
    }

    const message = compactError(error);
    const isRateLimited = rateLimitError(message) || Number(statusCode) === 429;
    const failures = Number(usage.consecutiveFailures || 0) + 1;
    const shouldCooldown = isRateLimited || failures >= lease.link.maxConsecutiveFailures;
    const cooldownUntil = shouldCooldown
      ? new Date(now.getTime() + Math.max(1, lease.link.cooldownMinutes) * 60 * 1000)
      : null;
    await tx.proxyUsage.update({
      where: { id: usage.id },
      data: {
        totalFailureCount: { increment: 1 },
        consecutiveFailures: failures,
        cooldownUntil,
        lastOutcome: isRateLimited ? "RATE_LIMITED" : "ERROR",
        lastError: message,
        lastStatusCode: statusCode,
        lastUsedAt: now
      }
    });
  });
}

function configFromProfile(baseConfig, profile, proxy) {
  const preset = findFingerprintPreset(profile.fingerprintPresetId);
  return {
    ...baseConfig,
    profileName: profile.profileDir,
    browserEngine: normalizeBrowserEngine(profile.browserEngine || baseConfig.browserEngine),
    proxy: proxy.value,
    userAgent: profile.userAgent || preset?.userAgent || baseConfig.userAgent || "",
    viewportWidth: Number(profile.viewportWidth || preset?.viewportWidth || baseConfig.viewportWidth) || 1440,
    viewportHeight: Number(profile.viewportHeight || preset?.viewportHeight || baseConfig.viewportHeight) || 900,
    locale: profile.locale || preset?.locale || baseConfig.locale || "en-US",
    timezoneId: profile.timezoneId || preset?.timezoneId || baseConfig.timezoneId || "America/Chicago",
    keepBrowserOpenOnFinish: false,
    rotateProfileEveryNRequests: 0,
    rotateFingerprintWithProfile: false,
    // API profiles need a dedicated persistent context. Camoufox safe mode
    // intentionally shares one browser and would bypass that profile state.
    safeModeEnabled: false
  };
}

async function allocateExecutionResources(api, baseConfig) {
  await clearStaleProfileLocks(baseConfig.browserJobTimeoutMs);
  let profile = null;
  let lease = null;

  if (api.profileMode === "STATIC" || api.profileMode === "AUTO") {
    while (true) {
      const candidate = await findAndLockStaticProfile(api);
      if (!candidate) break;
      try {
        lease = await claimProxyForApi(api, candidate.proxyId);
        profile = candidate;
        break;
      } catch (err) {
        await releaseProfile(candidate, { finished: false });
        if (api.profileMode === "STATIC") throw err;
      }
    }
    if (!profile && api.profileMode === "STATIC") {
      throw new ApiPlatformError("No unlocked static profile is available for this API.", {
        status: 429,
        code: "STATIC_PROFILE_UNAVAILABLE",
        retryAfterSeconds: 3
      });
    }
  }

  if (!profile) {
    profile = await findAndLockDisposableProfile(api);
    if (profile) {
      try {
        lease = await claimProxyForApi(api, profile.proxyId);
      } catch (err) {
        await releaseProfile(profile, { finished: false });
        throw err;
      }
    } else {
      lease = await claimProxyForApi(api);
      try {
        profile = await createDisposableProfile(api, lease.proxy, baseConfig);
      } catch (err) {
        await recordProxyOutcome(lease, { ok: false, error: "Disposable profile allocation failed" }).catch(() => {});
        throw err;
      }
    }
  }

  return { profile, lease };
}

function extractResultFailure(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  if (result.ok === false) return compactError(result.error || "Script returned ok: false");
  return null;
}

export async function invokePublicApi({ slug, input, executeScript, getBaseConfig, scriptsDir }) {
  const api = await getApiWithRelations(normalizeSlug(slug), true);
  if (!api.enabled) {
    throw new ApiPlatformError("API is disabled.", { status: 404, code: "API_DISABLED" });
  }
  const validatedInput = validateApiInput(api.inputSchema, input);
  const safeName = sanitizeScriptName(api.scriptName);
  const filePath = safeName ? path.join(scriptsDir, safeName) : null;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new ApiPlatformError(`API script ${api.scriptName} was not found.`, { status: 500, code: "API_SCRIPT_MISSING" });
  }

  const releaseSlot = await acquireApiSlot(api);
  let resources = null;
  let apiRun = null;
  const startedAt = Date.now();
  try {
    const baseConfig = getBaseConfig();
    const execution = await executeScript({
      scriptName: safeName,
      code: fs.readFileSync(filePath, "utf8"),
      config: baseConfig,
      ephemeral: false,
      input: validatedInput,
      prepareSession: async () => {
        resources = await allocateExecutionResources(api, baseConfig);
        apiRun = await getPrisma().apiRun.create({
          data: {
            apiId: api.id,
            proxyId: resources.lease.proxy.id,
            profileId: resources.profile.id,
            status: "RUNNING",
            input: jsonValue(validatedInput),
            startedAt: new Date()
          }
        });
        return {
          config: configFromProfile(baseConfig, resources.profile, resources.lease.proxy),
          ephemeral: false
        };
      }
    });
    const failure = extractResultFailure(execution.result);
    const status = failure ? "FAILED" : "SUCCEEDED";
    const finishedAt = new Date();
    await getPrisma().apiRun.update({
      where: { id: apiRun.id },
      data: {
        status,
        result: jsonValue(execution.result),
        error: failure,
        traffic: jsonValue(execution.traffic),
        finishedAt,
        durationMs: Date.now() - startedAt
      }
    });
    await recordProxyOutcome(resources.lease, { ok: !failure, error: failure });

    return {
      ok: !failure,
      api: { id: api.id, name: api.name, slug: api.slug, targetDomain: api.targetDomain },
      result: execution.result,
      error: failure,
      meta: {
        runId: apiRun.id,
        durationMs: Date.now() - startedAt,
        traffic: execution.traffic || null,
        proxy: {
          id: resources.lease.proxy.id,
          label: resources.lease.proxy.label,
          poolId: resources.lease.pool.id,
          poolName: resources.lease.pool.name,
          dynamic: resources.lease.pool.type === "DYNAMIC"
        },
        profile: { id: resources.profile.id, name: resources.profile.name, type: resources.profile.type }
      }
    };
  } catch (err) {
    const message = compactError(err);
    if (apiRun) {
      await getPrisma().apiRun.update({
        where: { id: apiRun.id },
        data: { status: "FAILED", error: message, finishedAt: new Date(), durationMs: Date.now() - startedAt }
      }).catch(() => {});
    }
    if (resources?.lease) {
      await recordProxyOutcome(resources.lease, { ok: false, error: message }).catch(() => {});
    }
    throw err;
  } finally {
    await releaseProfile(resources?.profile, { finished: Boolean(resources?.profile) });
    releaseSlot();
  }
}

export async function listApis() {
  const db = getPrisma();
  const apis = await db.api.findMany({
    include: {
      proxyPools: { include: { pool: { include: { proxies: { where: { enabled: true } } } } } },
      profileLinks: { include: { profile: { include: { proxy: true } } } },
      proxyUsages: true
    },
    orderBy: { name: "asc" }
  });
  return apis.map(apiSnapshot);
}

export async function getApi(id) {
  return apiSnapshot(await getApiWithRelations(id));
}

function documentationExampleValue(field) {
  if (field?.default !== null && field?.default !== undefined && field.default !== "") return field.default;
  if (field?.type === "number") return 1;
  if (field?.type === "boolean") return true;
  if (field?.type === "json") return { example: field.name };
  return `example-${field?.name || "value"}`;
}

function documentationInput(schema) {
  return Object.fromEntries(
    (Array.isArray(schema) ? schema : []).map((field) => [field.name, documentationExampleValue(field)])
  );
}

function inferInputSchemaFromScript(scriptName, scriptsDir, declaredSchema) {
  const schema = Array.isArray(declaredSchema) ? [...declaredSchema] : [];
  if (!scriptsDir) return schema;

  const safeName = sanitizeScriptName(scriptName);
  const filePath = safeName ? path.join(scriptsDir, safeName) : null;
  if (!filePath || !fs.existsSync(filePath)) return schema;

  const knownNames = new Set(schema.map((field) => field?.name).filter(Boolean));
  const inferredNames = new Set();
  const source = fs.readFileSync(filePath, "utf8");
  const dotAccess = /\binput\s*(?:\?\.|\.)\s*([A-Za-z_][A-Za-z0-9_]*)\b/g;
  const bracketAccess = /\binput\s*\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g;

  for (const expression of [dotAccess, bracketAccess]) {
    let match;
    while ((match = expression.exec(source))) inferredNames.add(match[1]);
  }

  for (const name of inferredNames) {
    if (knownNames.has(name)) continue;
    schema.push({
      name,
      type: "string",
      required: false,
      default: null,
      description: `Inferred from input.${name} in ${safeName}.`
    });
  }
  return schema;
}

function documentationQuery(input) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  return params.toString();
}

export async function getPublicApiDocumentation(slug, baseUrl, scriptsDir = null) {
  const api = apiSnapshot(await getApiWithRelations(normalizeSlug(slug), true));
  const origin = String(baseUrl || "").replace(/\/+$/, "");
  const endpoint = `${origin}/v1/${api.slug}`;
  const inputSchema = inferInputSchemaFromScript(api.scriptName, scriptsDir, api.inputSchema);
  const exampleInput = documentationInput(inputSchema);
  const query = documentationQuery(exampleInput);
  const getUrl = query ? `${endpoint}?${query}` : endpoint;
  const postBody = JSON.stringify(exampleInput, null, 2);

  return {
    ok: true,
    api: {
      id: api.id,
      name: api.name,
      slug: api.slug,
      targetDomain: api.targetDomain,
      enabled: api.enabled,
      scriptName: api.scriptName
    },
    endpoint,
    documentationEndpoint: `${endpoint}/docs`,
    methods: ["GET", "POST"],
    inputSchema,
    example: {
      input: exampleInput,
      getUrl,
      post: {
        url: endpoint,
        headers: { "Content-Type": "application/json" },
        body: exampleInput
      },
      curl: {
        get: `curl "${getUrl}"`,
        post: [
          `curl -X POST "${endpoint}" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -d '${postBody}'`
        ].join("\n")
      }
    }
  };
}

function apiWriteData(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) throw new ApiPlatformError("API name is required.", { code: "API_NAME_REQUIRED" });
    data.name = name;
  }
  if (!partial || body.slug !== undefined) data.slug = normalizeSlug(body.slug || data.name);
  if (!partial || body.scriptName !== undefined) {
    const scriptName = sanitizeScriptName(body.scriptName);
    if (!scriptName) throw new ApiPlatformError("Select a valid API script.", { code: "INVALID_API_SCRIPT" });
    data.scriptName = scriptName;
  }
  if (!partial || body.targetDomain !== undefined) data.targetDomain = normalizeTargetDomain(body.targetDomain);
  if (!partial || body.inputSchema !== undefined) data.inputSchema = parseInputSchema(body.inputSchema);
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (!partial || body.maxConcurrentRuns !== undefined) data.maxConcurrentRuns = toPositiveInt(body.maxConcurrentRuns, 1, 1, 128);
  if (!partial || body.maxQueuedRequests !== undefined) data.maxQueuedRequests = toPositiveInt(body.maxQueuedRequests, 100, 0, 10000);
  if (!partial || body.profileMode !== undefined) data.profileMode = normalizeProfileMode(body.profileMode);
  if (!partial || body.disposableProfileMaxRequests !== undefined) {
    data.disposableProfileMaxRequests = toPositiveInt(body.disposableProfileMaxRequests, 1, 1, 100000);
  }
  if (!partial || body.disposableProfileRetentionMinutes !== undefined) {
    data.disposableProfileRetentionMinutes = toPositiveInt(body.disposableProfileRetentionMinutes, 0, 0, 43200);
  }
  return data;
}

export async function createApi(body) {
  const db = getPrisma();
  const data = apiWriteData(body);
  const api = await db.api.create({ data });
  return await getApi(api.id);
}

export async function updateApi(id, body) {
  const db = getPrisma();
  await getApiWithRelations(id);
  const data = apiWriteData(body, { partial: true });
  if (!Object.keys(data).length) throw new ApiPlatformError("No API fields were provided.", { code: "EMPTY_API_UPDATE" });
  await db.api.update({ where: { id }, data });
  return await getApi(id);
}

export async function deleteApi(id) {
  const db = getPrisma();
  const disposable = await db.browserProfile.findMany({ where: { apiId: id, type: "DISPOSABLE" } });
  for (const profile of disposable) await removeProfileDirectory(profile.profileDir).catch(() => {});
  await db.api.delete({ where: { id } });
  return { ok: true };
}

function normalizePoolWrite(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) throw new ApiPlatformError("Proxy pool name is required.", { code: "PROXY_POOL_NAME_REQUIRED" });
    data.name = name;
  }
  if (!partial || body.type !== undefined) data.type = normalizeProxyPoolType(body.type);
  if (body.description !== undefined) data.description = toOptionalString(body.description, 1000);
  return data;
}

export async function listProxyPools() {
  const db = getPrisma();
  const pools = await db.proxyPool.findMany({
    include: {
      proxies: {
        include: { usages: { orderBy: { lastUsedAt: "desc" } } },
        orderBy: { createdAt: "asc" }
      },
      apiLinks: { include: { api: true } }
    },
    orderBy: { name: "asc" }
  });
  return pools.map((pool) => ({
    id: pool.id,
    name: pool.name,
    type: pool.type,
    description: pool.description,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    apiCount: pool.apiLinks.length,
    apis: pool.apiLinks.map((link) => ({ id: link.api.id, name: link.api.name, slug: link.api.slug })),
    proxies: pool.proxies.map((proxy) => {
      const latestUsage = proxy.usages[0] || null;
      return publicProxy(proxy, latestUsage);
    })
  }));
}

export async function createProxyPool(body) {
  const db = getPrisma();
  const data = normalizePoolWrite(body);
  const proxies = parseProxyText(body.proxiesText || body.proxies || "");
  if (data.type === "DYNAMIC" && proxies.length !== 1) {
    throw new ApiPlatformError("A dynamic proxy pool must contain exactly one proxy.", {
      code: "DYNAMIC_PROXY_POOL_REQUIRES_ONE_PROXY"
    });
  }
  return await db.proxyPool.create({
    data: {
      ...data,
      proxies: proxies.length ? { create: proxies } : undefined
    }
  });
}

export async function updateProxyPool(id, body) {
  const db = getPrisma();
  const data = normalizePoolWrite(body, { partial: true });
  if (!Object.keys(data).length) throw new ApiPlatformError("No proxy pool fields were provided.", { code: "EMPTY_PROXY_POOL_UPDATE" });
  if (data.type === "DYNAMIC") {
    const count = await db.proxy.count({ where: { poolId: id } });
    if (count !== 1) {
      throw new ApiPlatformError("A dynamic proxy pool must contain exactly one proxy.", {
        code: "DYNAMIC_PROXY_POOL_REQUIRES_ONE_PROXY"
      });
    }
  }
  return await db.proxyPool.update({ where: { id }, data });
}

export async function deleteProxyPool(id) {
  await getPrisma().proxyPool.delete({ where: { id } });
  return { ok: true };
}

export async function addProxiesToPool(poolId, body) {
  const db = getPrisma();
  const pool = await db.proxyPool.findUnique({ where: { id: poolId }, include: { proxies: true } });
  if (!pool) throw new ApiPlatformError("Proxy pool not found.", { status: 404, code: "PROXY_POOL_NOT_FOUND" });
  const proxies = parseProxyText(body.proxiesText || body.proxies || "");
  if (!proxies.length) throw new ApiPlatformError("Provide at least one proxy.", { code: "NO_PROXIES_PROVIDED" });
  if (pool.type === "DYNAMIC" && pool.proxies.length + proxies.length !== 1) {
    throw new ApiPlatformError("A dynamic proxy pool must contain exactly one proxy.", {
      code: "DYNAMIC_PROXY_POOL_REQUIRES_ONE_PROXY"
    });
  }
  const result = await db.proxy.createMany({
    data: proxies.map((proxy) => ({ poolId, ...proxy })),
    skipDuplicates: true
  });
  return { ok: true, inserted: result.count };
}

export async function updateProxy(proxyId, body) {
  const db = getPrisma();
  const proxy = await db.proxy.findUnique({ where: { id: proxyId }, include: { pool: true } });
  if (!proxy) throw new ApiPlatformError("Proxy not found.", { status: 404, code: "PROXY_NOT_FOUND" });
  const data = {};
  if (body.value !== undefined) Object.assign(data, normalizeProxyValue(body.value));
  if (body.label !== undefined) data.label = toOptionalString(body.label, 200);
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  return await db.proxy.update({ where: { id: proxyId }, data });
}

export async function deleteProxy(proxyId) {
  await getPrisma().proxy.delete({ where: { id: proxyId } });
  return { ok: true };
}

export async function setApiProxyPools(apiId, assignments) {
  const db = getPrisma();
  await getApiWithRelations(apiId);
  if (!Array.isArray(assignments) || assignments.length > 20) {
    throw new ApiPlatformError("Provide up to 20 proxy pool assignments.", { code: "INVALID_PROXY_POOL_ASSIGNMENTS" });
  }
  const unique = new Map();
  for (const item of assignments) {
    const poolId = String(item?.poolId || "").trim();
    if (!poolId) continue;
    unique.set(poolId, {
      apiId,
      poolId,
      enabled: item?.enabled !== false,
      requestsPerHour: toPositiveInt(item?.requestsPerHour, 60, 1, 100000),
      cooldownMinutes: toPositiveInt(item?.cooldownMinutes, 30, 1, 10080),
      maxConsecutiveFailures: toPositiveInt(item?.maxConsecutiveFailures, 2, 1, 100)
    });
  }
  const poolIds = [...unique.keys()];
  const found = await db.proxyPool.count({ where: { id: { in: poolIds } } });
  if (found !== poolIds.length) throw new ApiPlatformError("One or more proxy pools do not exist.", { code: "PROXY_POOL_NOT_FOUND" });
  await db.$transaction([
    db.apiProxyPool.deleteMany({ where: { apiId } }),
    ...(unique.size ? [db.apiProxyPool.createMany({ data: [...unique.values()] })] : [])
  ]);
  return await getApi(apiId);
}

export async function listProfiles() {
  const profiles = await getPrisma().browserProfile.findMany({
    where: { type: "STATIC" },
    include: { proxy: true, apiLinks: { include: { api: true } } },
    orderBy: { name: "asc" }
  });
  return profiles.map((profile) => ({
    ...profileSnapshot(profile),
    apiCount: profile.apiLinks.length,
    apis: profile.apiLinks.map((link) => ({ id: link.api.id, name: link.api.name, slug: link.api.slug }))
  }));
}

function profileWriteData(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) throw new ApiPlatformError("Profile name is required.", { code: "PROFILE_NAME_REQUIRED" });
    const profileDir = name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^[-.]+|[-.]+$/g, "");
    if (!profileDir) throw new ApiPlatformError("Profile name has no usable path characters.", { code: "INVALID_PROFILE_NAME" });
    data.name = name;
    data.profileDir = profileDir;
  }
  if (!partial || body.proxyId !== undefined) {
    const proxyId = String(body.proxyId || "").trim();
    if (!proxyId) throw new ApiPlatformError("Static profiles require a fixed proxy.", { code: "PROFILE_PROXY_REQUIRED" });
    data.proxyId = proxyId;
  }
  if (!partial || body.browserEngine !== undefined) data.browserEngine = normalizeBrowserEngine(body.browserEngine);
  if (body.userAgent !== undefined) data.userAgent = toOptionalString(body.userAgent, 2048);
  if (!partial || body.viewportWidth !== undefined) data.viewportWidth = toPositiveInt(body.viewportWidth, 1440, 320, 10000);
  if (!partial || body.viewportHeight !== undefined) data.viewportHeight = toPositiveInt(body.viewportHeight, 900, 320, 10000);
  if (!partial || body.locale !== undefined) data.locale = String(body.locale || "en-US").trim().slice(0, 100) || "en-US";
  if (!partial || body.timezoneId !== undefined) data.timezoneId = String(body.timezoneId || "America/Chicago").trim().slice(0, 100) || "America/Chicago";
  if (body.fingerprintPresetId !== undefined) {
    const presetId = toOptionalString(body.fingerprintPresetId, 120);
    if (presetId && !findFingerprintPreset(presetId)) {
      throw new ApiPlatformError("Unknown fingerprint preset.", { code: "UNKNOWN_FINGERPRINT_PRESET" });
    }
    data.fingerprintPresetId = presetId;
  }
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  return data;
}

export async function createProfile(body) {
  const db = getPrisma();
  const data = profileWriteData(body);
  const proxy = await db.proxy.findUnique({ where: { id: data.proxyId } });
  if (!proxy) throw new ApiPlatformError("Fixed proxy not found.", { code: "PROFILE_PROXY_NOT_FOUND" });
  return profileSnapshot(await db.browserProfile.create({ data: { ...data, type: "STATIC" }, include: { proxy: true } }));
}

export async function updateProfile(id, body) {
  const db = getPrisma();
  const previous = await db.browserProfile.findUnique({ where: { id } });
  if (!previous || previous.type !== "STATIC") {
    throw new ApiPlatformError("Static profile not found.", { status: 404, code: "PROFILE_NOT_FOUND" });
  }
  const data = profileWriteData(body, { partial: true });
  if (data.proxyId) {
    const proxy = await db.proxy.findUnique({ where: { id: data.proxyId } });
    if (!proxy) throw new ApiPlatformError("Fixed proxy not found.", { code: "PROFILE_PROXY_NOT_FOUND" });
  }
  if (!Object.keys(data).length) throw new ApiPlatformError("No profile fields were provided.", { code: "EMPTY_PROFILE_UPDATE" });
  if (data.profileDir && data.profileDir !== previous.profileDir) {
    const oldPath = path.join(PROFILE_ROOT, previous.profileDir);
    const newPath = path.join(PROFILE_ROOT, data.profileDir);
    if (fs.existsSync(oldPath)) await fsp.rename(oldPath, newPath);
  }
  return profileSnapshot(await db.browserProfile.update({ where: { id }, data, include: { proxy: true } }));
}

export async function deleteProfile(id) {
  const db = getPrisma();
  const profile = await db.browserProfile.findUnique({ where: { id } });
  if (!profile || profile.type !== "STATIC") {
    throw new ApiPlatformError("Static profile not found.", { status: 404, code: "PROFILE_NOT_FOUND" });
  }
  await db.browserProfile.delete({ where: { id } });
  await removeProfileDirectory(profile.profileDir).catch(() => {});
  return { ok: true };
}

export async function setApiProfiles(apiId, profileIds) {
  const db = getPrisma();
  await getApiWithRelations(apiId);
  if (!Array.isArray(profileIds) || profileIds.length > 100) {
    throw new ApiPlatformError("Provide up to 100 static profile ids.", { code: "INVALID_PROFILE_ASSIGNMENTS" });
  }
  const uniqueIds = [...new Set(profileIds.map((value) => String(value || "").trim()).filter(Boolean))];
  const count = await db.browserProfile.count({ where: { id: { in: uniqueIds }, type: "STATIC" } });
  if (count !== uniqueIds.length) throw new ApiPlatformError("One or more static profiles do not exist.", { code: "PROFILE_NOT_FOUND" });
  await db.$transaction([
    db.apiProfileLink.deleteMany({ where: { apiId } }),
    ...(uniqueIds.length ? [db.apiProfileLink.createMany({ data: uniqueIds.map((profileId) => ({ apiId, profileId })) })] : [])
  ]);
  return await getApi(apiId);
}

function inferTargetDomain(code) {
  const match = String(code || "").match(/(?:page\.)?goto\(\s*["'`](https?:\/\/[^"'`]+)/i);
  if (!match) return null;
  try {
    return new URL(match[1]).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function importLegacyScripts({ scriptsDir, config }) {
  const db = getPrisma();
  const files = fs
    .readdirSync(scriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name)
    .sort();
  let created = 0;
  let skipped = 0;
  const imported = [];
  for (const scriptName of files) {
    const existing = await db.api.findFirst({ where: { scriptName } });
    if (existing) {
      skipped += 1;
      continue;
    }
    const stem = scriptName.replace(/\.js$/i, "");
    let slug = normalizeSlug(stem);
    let sequence = 2;
    while (await db.api.findUnique({ where: { slug } })) {
      slug = `${normalizeSlug(stem).slice(0, 70)}-${sequence++}`;
    }
    const domain = inferTargetDomain(fs.readFileSync(path.join(scriptsDir, scriptName), "utf8"));
    const api = await db.api.create({
      data: {
        name: stem,
        slug,
        scriptName,
        targetDomain: domain || "configure-me.invalid",
        enabled: Boolean(domain)
      }
    });
    imported.push({ id: api.id, name: api.name, slug: api.slug, enabled: api.enabled, targetDomain: api.targetDomain });
    created += 1;
  }

  let importedProfile = null;
  const profileName = String(config?.profileName || "default").trim() || "default";
  if (String(config?.proxy || "").trim()) {
    const normalized = normalizeProxyValue(config.proxy);
    const pool = await db.proxyPool.upsert({
      where: { name: "Imported default proxy" },
      create: { name: "Imported default proxy", type: "STATIC" },
      update: {}
    });
    const proxy = await db.proxy.upsert({
      where: { poolId_value: { poolId: pool.id, value: normalized.value } },
      create: { poolId: pool.id, ...normalized },
      update: {}
    });
    let profile = await db.browserProfile.findUnique({ where: { profileDir: profileName } });
    if (!profile) {
      profile = await db.browserProfile.create({
        data: {
          name: profileName,
          profileDir: profileName,
          type: "STATIC",
          proxyId: proxy.id,
          browserEngine: normalizeBrowserEngine(config.browserEngine),
          userAgent: config.userAgent || null,
          viewportWidth: Number(config.viewportWidth) || 1440,
          viewportHeight: Number(config.viewportHeight) || 900,
          locale: config.locale || "en-US",
          timezoneId: config.timezoneId || "America/Chicago"
        }
      });
    }
    const canUseImportedProfile = profile.type === "STATIC" && profile.proxyId === proxy.id;
    importedProfile = { id: profile.id, name: profile.name, proxyId: profile.proxyId, linked: canUseImportedProfile };

    const apiIds = imported.map((api) => api.id);
    if (apiIds.length) {
      const operations = [
        db.apiProxyPool.createMany({
          data: apiIds.map((apiId) => ({ apiId, poolId: pool.id })),
          skipDuplicates: true
        })
      ];
      if (canUseImportedProfile) {
        operations.push(
          db.apiProfileLink.createMany({
            data: apiIds.map((apiId) => ({ apiId, profileId: profile.id })),
            skipDuplicates: true
          }),
          db.api.updateMany({ where: { id: { in: apiIds } }, data: { profileMode: "AUTO" } })
        );
      }
      await db.$transaction(operations);
    }
  }
  return { ok: true, created, skipped, imported, importedProfile };
}

export async function listApiRuns(apiId, take = 50) {
  const runs = await getPrisma().apiRun.findMany({
    where: { apiId },
    include: { proxy: true, profile: true },
    orderBy: { queuedAt: "desc" },
    take: toPositiveInt(take, 50, 1, 200)
  });
  return runs.map((run) => ({
    id: run.id,
    status: run.status,
    input: run.input,
    result: run.result,
    error: run.error,
    traffic: run.traffic,
    queuedAt: run.queuedAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationMs: run.durationMs,
    proxy: run.proxy ? { id: run.proxy.id, label: run.proxy.label, poolId: run.proxy.poolId } : null,
    profile: run.profile ? { id: run.profile.id, name: run.profile.name, type: run.profile.type } : null
  }));
}
