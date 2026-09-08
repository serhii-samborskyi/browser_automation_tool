import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = path.dirname(__filename);
const DEBUG_ARTIFACT_DIR = path.join(PROJECT_DIR, "data", "mcp-debug");
let appUrl = new URL(process.env.BROWSER_API_URL || "http://127.0.0.1:4300");
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.BROWSER_API_TIMEOUT_MS) || 300000);
const MAX_SCRIPT_BYTES = 1024 * 1024;
const MAX_DEBUG_SCREENSHOT_BYTES = 10 * 1024 * 1024;
const DEBUG_ARTIFACT_MAX_AGE_MS = 60 * 60 * 1000;

function textResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }]
  };
}

function errorResult(error) {
  const message = String(error?.message || error || "Unknown MCP error");
  const details = error?.details && typeof error.details === "object" ? error.details : undefined;
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ ok: false, error: message, details }, null, 2) }]
  };
}

function normalizeInput(input) {
  return input && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function queryValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

async function appRequest(pathname, { method = "GET", body, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const url = new URL(pathname, appUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const error = new Error(`Browser API Factory HTTP ${response.status}: ${data?.error || text || response.statusText}`);
      error.details = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Browser API Factory did not respond within ${timeoutMs}ms at ${appUrl.origin}.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function browserConfigSummary(config) {
  const proxy = String(config?.proxy || "").trim();
  return {
    profileName: config?.profileName || "default",
    browserEngine: config?.browserEngine || "chromium",
    headless: Boolean(config?.headless),
    proxyConfigured: Boolean(proxy),
    advancedFingerprintMode: Boolean(config?.advancedFingerprintMode),
    usePlaywrightWithFingerprints: Boolean(config?.usePlaywrightWithFingerprints),
    viewport: {
      width: Number(config?.viewportWidth) || 1440,
      height: Number(config?.viewportHeight) || 900
    },
    locale: config?.locale || "en-US",
    timezoneId: config?.timezoneId || "America/Chicago",
    timeoutMs: Number(config?.timeoutMs) || 120000,
    safeModeEnabled: Boolean(config?.safeModeEnabled)
  };
}

async function getRuntimeConfig() {
  return await appRequest("/api/config", { timeoutMs: 15000 });
}

async function runSavedScript({ scriptName, input = {}, ephemeral = false }) {
  const config = await getRuntimeConfig();
  const url = new URL("/api/run-sync", appUrl);
  url.searchParams.set("scriptName", scriptName);
  url.searchParams.set("includeLogs", "true");
  url.searchParams.set("ephemeral", String(Boolean(ephemeral)));
  // The sync endpoint keeps advanced settings opt-in for backwards
  // compatibility. Explicitly pass the current setup so MCP debugging uses
  // the same configured fingerprint engine as normal browser work.
  url.searchParams.set("advancedFingerprintMode", String(Boolean(config.advancedFingerprintMode)));
  url.searchParams.set("usePlaywrightWithFingerprints", String(Boolean(config.usePlaywrightWithFingerprints)));
  for (const [key, value] of Object.entries(normalizeInput(input))) {
    const serialized = queryValue(value);
    if (serialized !== undefined) url.searchParams.set(key, serialized);
  }
  return await appRequest(`${url.pathname}${url.search}`, { timeoutMs: REQUEST_TIMEOUT_MS });
}

async function runInlineDebug({ code, input = {}, ephemeral = false }) {
  const scriptName = `mcp_debug_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}.js`;
  await appRequest(`/api/scripts/${encodeURIComponent(scriptName)}`, {
    method: "PUT",
    body: { content: code },
    timeoutMs: 15000
  });
  try {
    return await runSavedScript({ scriptName, input, ephemeral });
  } finally {
    await appRequest(`/api/scripts/${encodeURIComponent(scriptName)}`, { method: "DELETE", timeoutMs: 15000 }).catch(() => {});
  }
}

function debugPageCode() {
  return `
const targetUrl = String(input.url || "").trim();
if (!targetUrl) throw new Error("input.url is required");

await page.goto(targetUrl, {
  waitUntil: input.waitUntil || "domcontentloaded",
  timeout: 60000
});

const waitAfterMs = Math.min(30000, Math.max(0, Number(input.waitAfterMs) || 0));
if (waitAfterMs) await sleep(waitAfterMs);

const selector = String(input.selector || "body");
const locator = page.locator(selector);
const count = await locator.count();
let text = "";
let html = "";
if (count) {
  const first = locator.first();
  text = await first.innerText().catch(() => "");
  html = await first.innerHTML().catch(() => "");
}

let screenshotPath = null;
if (input.screenshotPath) {
  screenshotPath = String(input.screenshotPath);
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

return {
  ok: true,
  title: await page.title(),
  url: page.url(),
  selector,
  count,
  text: text.slice(0, Math.max(1, Number(input.textLimit) || 12000)),
  html: html.slice(0, Math.max(1, Number(input.htmlLimit) || 20000)),
  screenshotPath
};`;
}

function isDebugArtifact(filePath) {
  const resolved = path.resolve(filePath);
  return resolved.startsWith(`${DEBUG_ARTIFACT_DIR}${path.sep}`) && resolved.endsWith(".png");
}

async function cleanupDebugArtifacts() {
  try {
    const cutoff = Date.now() - DEBUG_ARTIFACT_MAX_AGE_MS;
    const entries = await fs.readdir(DEBUG_ARTIFACT_DIR, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
        .map(async (entry) => {
          const filePath = path.join(DEBUG_ARTIFACT_DIR, entry.name);
          const stat = await fs.stat(filePath);
          if (stat.mtimeMs < cutoff) await fs.unlink(filePath);
        })
    );
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.error("Browser API Factory MCP screenshot cleanup failed:", error?.message || error);
    }
  }
}

async function pageDebugResult(args) {
  const screenshotPath = args.screenshot
    ? path.join(DEBUG_ARTIFACT_DIR, `page-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`)
    : null;
  if (screenshotPath) {
    await fs.mkdir(DEBUG_ARTIFACT_DIR, { recursive: true });
    await cleanupDebugArtifacts();
  }

  const run = await runInlineDebug({
    code: debugPageCode(),
    input: {
      url: args.url,
      selector: args.selector || "body",
      waitUntil: args.waitUntil,
      waitAfterMs: args.waitAfterMs,
      textLimit: args.textLimit,
      htmlLimit: args.htmlLimit,
      screenshotPath
    },
    ephemeral: args.ephemeral
  });

  const content = [{ type: "text", text: JSON.stringify(run, null, 2) }];
  const artifactPath = run?.result?.screenshotPath;
  if (artifactPath && isDebugArtifact(artifactPath)) {
    try {
      const stat = await fs.stat(artifactPath);
      if (stat.size <= MAX_DEBUG_SCREENSHOT_BYTES) {
        content.push({ type: "image", data: (await fs.readFile(artifactPath)).toString("base64"), mimeType: "image/png" });
      }
    } catch {
      // The text result retains the artifact path if the image cannot be read.
    }
  }
  return { content, isError: run?.ok === false };
}

export function createBrowserApiFactoryMcpServer({ appUrl: targetAppUrl } = {}) {
  if (targetAppUrl) appUrl = new URL(targetAppUrl);
  const server = new McpServer(
    { name: "browser-api-factory", version: "0.2.0" },
    {
      instructions:
        "Use browser_factory_status before browser work. Read a saved script before changing it. Use browser_factory_debug_page for fast selector inspection, then browser_factory_debug_run for targeted Playwright experiments. Debug runs use the Browser API Factory browser configuration and remove their temporary script after execution."
    }
  );

  server.registerTool(
    "browser_factory_status",
    {
      title: "Browser API Factory status",
      description: "Returns app health and a redacted summary of the browser setup that all MCP debug runs will use. Proxy credentials are never returned."
    },
    async () => {
      try {
        const [health, config] = await Promise.all([
          appRequest("/api/health", { timeoutMs: 15000 }),
          getRuntimeConfig()
        ]);
        return textResult({ ok: true, appUrl: appUrl.origin, health, browser: browserConfigSummary(config) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_factory_list_scripts",
    {
      title: "List automation scripts",
      description: "Lists JavaScript automation files available in Browser API Factory."
    },
    async () => {
      try {
        return textResult({ ok: true, scripts: await appRequest("/api/scripts", { timeoutMs: 15000 }) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_factory_read_script",
    {
      title: "Read automation script",
      description: "Reads a saved automation script before editing or running it.",
      inputSchema: z.object({ scriptName: z.string().min(1).max(255) })
    },
    async ({ scriptName }) => {
      try {
        return textResult({ ok: true, script: await appRequest(`/api/scripts/${encodeURIComponent(scriptName)}`, { timeoutMs: 15000 }) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_factory_write_script",
    {
      title: "Create or update automation script",
      description: "Creates or replaces one saved JavaScript automation script. The code runs in the documented Browser API Factory runtime context.",
      inputSchema: z.object({
        scriptName: z.string().min(1).max(255),
        content: z.string().min(1).max(MAX_SCRIPT_BYTES)
      })
    },
    async ({ scriptName, content }) => {
      try {
        const saved = await appRequest(`/api/scripts/${encodeURIComponent(scriptName)}`, {
          method: "PUT",
          body: { content },
          timeoutMs: 15000
        });
        return textResult({ ok: true, saved });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_factory_delete_script",
    {
      title: "Delete automation script",
      description: "Permanently removes a saved JavaScript automation script.",
      inputSchema: z.object({ scriptName: z.string().min(1).max(255) })
    },
    async ({ scriptName }) => {
      try {
        return textResult({ ok: true, deleted: await appRequest(`/api/scripts/${encodeURIComponent(scriptName)}`, { method: "DELETE", timeoutMs: 15000 }) });
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_factory_run_script",
    {
      title: "Run saved automation script",
      description: "Runs a saved script synchronously with browser logs and JSON result. It uses the active Browser API Factory browser engine, profile, fingerprint, proxy, and queue configuration.",
      inputSchema: z.object({
        scriptName: z.string().min(1).max(255),
        input: z.record(z.string(), z.unknown()).optional().default({}),
        ephemeral: z.boolean().optional().default(false)
      })
    },
    async ({ scriptName, input, ephemeral }) => {
      try {
        return textResult(await runSavedScript({ scriptName, input, ephemeral }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_factory_debug_run",
    {
      title: "Run temporary browser debug code",
      description: "Runs temporary async Playwright code for debugging. The code receives page, context, browser, playwright, log, sleep, config, input, and setResult. Return JSON for a structured result. The temporary script is deleted after the run.",
      inputSchema: z.object({
        code: z.string().min(1).max(MAX_SCRIPT_BYTES),
        input: z.record(z.string(), z.unknown()).optional().default({}),
        ephemeral: z.boolean().optional().default(false)
      })
    },
    async ({ code, input, ephemeral }) => {
      try {
        return textResult(await runInlineDebug({ code, input, ephemeral }));
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    "browser_factory_debug_page",
    {
      title: "Inspect page with configured browser",
      description: "Navigates using the configured browser setup and returns title, final URL, locator count, visible text, HTML, browser logs, and optionally a PNG screenshot. Use this to discover stable selectors before writing a script.",
      inputSchema: z.object({
        url: z.string().url(),
        selector: z.string().min(1).max(1000).optional().default("body"),
        waitUntil: z.enum(["commit", "domcontentloaded", "load", "networkidle"]).optional().default("domcontentloaded"),
        waitAfterMs: z.number().int().min(0).max(30000).optional().default(0),
        textLimit: z.number().int().min(1).max(50000).optional().default(12000),
        htmlLimit: z.number().int().min(1).max(100000).optional().default(20000),
        screenshot: z.boolean().optional().default(false),
        ephemeral: z.boolean().optional().default(false)
      })
    },
    async (args) => {
      try {
        return await pageDebugResult(args);
      } catch (error) {
        return errorResult(error);
      }
    }
  );

  return server;
}

async function main() {
  await serveStdio(createBrowserApiFactoryMcpServer);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error("Browser API Factory MCP failed:", error?.stack || error);
    process.exit(1);
  });
}
