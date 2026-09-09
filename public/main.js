const scriptsList = document.getElementById("scriptsList");
const currentScriptTitle = document.getElementById("currentScriptTitle");
const scriptEditor = document.getElementById("scriptEditor");
const runLogs = document.getElementById("runLogs");
const runsList = document.getElementById("runsList");
const syncInputsList = document.getElementById("syncInputsList");
const addSyncInputBtn = document.getElementById("addSyncInputBtn");
const runSyncBtn = document.getElementById("runSyncBtn");
const syncIncludeLogs = document.getElementById("syncIncludeLogs");
const syncResult = document.getElementById("syncResult");
const apiDocsBtn = document.getElementById("apiDocsBtn");
const apiDocsModal = document.getElementById("apiDocsModal");
const closeApiDocsBtn = document.getElementById("closeApiDocsBtn");
const metricProcesses = document.getElementById("metricProcesses");
const metricQueue = document.getElementById("metricQueue");
const metricCpu = document.getElementById("metricCpu");
const metricCpuSub = document.getElementById("metricCpuSub");
const metricRam = document.getElementById("metricRam");
const metricRamSub = document.getElementById("metricRamSub");
const metricGpu = document.getElementById("metricGpu");
const metricGpuSub = document.getElementById("metricGpuSub");
const metricDisk = document.getElementById("metricDisk");
const metricDiskSub = document.getElementById("metricDiskSub");
const appConnectionStatus = document.getElementById("appConnectionStatus");
const localModeBadge = document.getElementById("localModeBadge");
const runStatusCard = document.getElementById("runStatusCard");
const runStatusTitle = document.getElementById("runStatusTitle");
const runStatusDetail = document.getElementById("runStatusDetail");
const toastRegion = document.getElementById("toastRegion");
const sectionTabs = [...document.querySelectorAll(".section-tab")];
const workspaceSections = [...document.querySelectorAll(".workspace-section")];

const profileName = document.getElementById("profileName");
const browserEngine = document.getElementById("browserEngine");
const proxy = document.getElementById("proxy");
const userAgent = document.getElementById("userAgent");
const viewportWidth = document.getElementById("viewportWidth");
const viewportHeight = document.getElementById("viewportHeight");
const localeInput = document.getElementById("locale");
const timezoneInput = document.getElementById("timezoneId");
const timeoutMs = document.getElementById("timeoutMs");
const rotateProfileEveryNRequests = document.getElementById("rotateProfileEveryNRequests");
const maxConcurrentRunSlots = document.getElementById("maxConcurrentRunSlots");
const maxQueuedRunSlots = document.getElementById("maxQueuedRunSlots");
const safeModeMinFreeRamGb = document.getElementById("safeModeMinFreeRamGb");
const browserJobTimeoutMs = document.getElementById("browserJobTimeoutMs");
const camoufoxSharedIdleMs = document.getElementById("camoufoxSharedIdleMs");
const headless = document.getElementById("headless");
const advancedFingerprintMode = document.getElementById("advancedFingerprintMode");
const usePlaywrightWithFingerprints = document.getElementById("usePlaywrightWithFingerprints");
const measureTrafficUsage = document.getElementById("measureTrafficUsage");
const keepBrowserOpenOnFinish = document.getElementById("keepBrowserOpenOnFinish");
const rotateFingerprintWithProfile = document.getElementById("rotateFingerprintWithProfile");
const safeModeEnabled = document.getElementById("safeModeEnabled");
const mcpAccessToken = document.getElementById("mcpAccessToken");
const mcpEndpoint = document.getElementById("mcpEndpoint");
const mcpSetupResult = document.getElementById("mcpSetupResult");
const proxyTestResult = document.getElementById("proxyTestResult");
const fingerprintPreset = document.getElementById("fingerprintPreset");

const newScriptBtn = document.getElementById("newScriptBtn");
const downloadScriptBtn = document.getElementById("downloadScriptBtn");
const uploadScriptBtn = document.getElementById("uploadScriptBtn");
const uploadScriptInput = document.getElementById("uploadScriptInput");
const saveScriptBtn = document.getElementById("saveScriptBtn");
const deleteScriptBtn = document.getElementById("deleteScriptBtn");
const runScriptBtn = document.getElementById("runScriptBtn");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const testProxyBtn = document.getElementById("testProxyBtn");
const refreshRunsBtn = document.getElementById("refreshRunsBtn");
const clearRunsBtn = document.getElementById("clearRunsBtn");
const recreateProfileBtn = document.getElementById("recreateProfileBtn");
const applyPresetBtn = document.getElementById("applyPresetBtn");
const generateMcpTokenBtn = document.getElementById("generateMcpTokenBtn");
const copyMcpEndpointBtn = document.getElementById("copyMcpEndpointBtn");
const copyMcpConfigBtn = document.getElementById("copyMcpConfigBtn");

const databaseStatus = document.getElementById("databaseStatus");
const importLegacyBtn = document.getElementById("importLegacyBtn");
const newApiBtn = document.getElementById("newApiBtn");
const apisList = document.getElementById("apisList");
const apiEditorTitle = document.getElementById("apiEditorTitle");
const apiEndpoint = document.getElementById("apiEndpoint");
const openApiDocsBtn = document.getElementById("openApiDocsBtn");
const editingApiId = document.getElementById("editingApiId");
const apiName = document.getElementById("apiName");
const apiSlug = document.getElementById("apiSlug");
const apiScriptName = document.getElementById("apiScriptName");
const apiTargetDomain = document.getElementById("apiTargetDomain");
const apiInputFields = document.getElementById("apiInputFields");
const addApiInputBtn = document.getElementById("addApiInputBtn");
const apiMaxConcurrentRuns = document.getElementById("apiMaxConcurrentRuns");
const apiMaxQueuedRequests = document.getElementById("apiMaxQueuedRequests");
const apiProfileMode = document.getElementById("apiProfileMode");
const apiDisposableMaxRequests = document.getElementById("apiDisposableMaxRequests");
const apiDisposableRetention = document.getElementById("apiDisposableRetention");
const apiPoolAssignments = document.getElementById("apiPoolAssignments");
const apiProfileAssignments = document.getElementById("apiProfileAssignments");
const apiEnabled = document.getElementById("apiEnabled");
const saveApiBtn = document.getElementById("saveApiBtn");
const deleteApiBtn = document.getElementById("deleteApiBtn");
const apiEditorResult = document.getElementById("apiEditorResult");
const proxyPoolName = document.getElementById("proxyPoolName");
const proxyPoolType = document.getElementById("proxyPoolType");
const proxyPoolDescription = document.getElementById("proxyPoolDescription");
const proxyPoolProxies = document.getElementById("proxyPoolProxies");
const createProxyPoolBtn = document.getElementById("createProxyPoolBtn");
const proxyPoolsList = document.getElementById("proxyPoolsList");
const staticProfileName = document.getElementById("staticProfileName");
const staticProfileProxy = document.getElementById("staticProfileProxy");
const staticProfileEngine = document.getElementById("staticProfileEngine");
const staticProfilePreset = document.getElementById("staticProfilePreset");
const createStaticProfileBtn = document.getElementById("createStaticProfileBtn");
const staticProfilesList = document.getElementById("staticProfilesList");
const docsBaseUrl = document.getElementById("docsBaseUrl");
const genericPublicApiDocs = document.getElementById("genericPublicApiDocs");
const selectedApiDocs = document.getElementById("selectedApiDocs");
const selectedApiDocsTitle = document.getElementById("selectedApiDocsTitle");
const selectedApiDocsTarget = document.getElementById("selectedApiDocsTarget");
const selectedApiDocsEndpoint = document.getElementById("selectedApiDocsEndpoint");
const selectedApiDocsJson = document.getElementById("selectedApiDocsJson");
const selectedApiDocsGet = document.getElementById("doc-selected-api-get");
const selectedApiDocsPost = document.getElementById("doc-selected-api-post");

let activeScript = null;
let selectedRunId = null;
let presets = [];
let availableScriptNames = [];
let platformApis = [];
let platformPools = [];
let platformProfiles = [];

function errorMessage(err) {
  const raw = err?.message || String(err || "Unknown error");
  try {
    const parsed = JSON.parse(raw);
    return parsed.error || raw;
  } catch {
    return raw;
  }
}

function setButtonLoading(button, loading, label = null) {
  if (!button) return;
  const labelNode = button.querySelector(".button-label");
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = labelNode?.textContent || button.textContent.trim();
  }
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  if (labelNode) {
    labelNode.textContent = loading ? label || "Working..." : button.dataset.defaultLabel;
  } else if (loading && label) {
    button.textContent = label;
  } else if (!loading) {
    button.textContent = button.dataset.defaultLabel;
  }
}

function setRunStatus(state, title, detail) {
  if (!runStatusCard) return;
  runStatusCard.className = `run-status-card ${state || "idle"}`;
  runStatusTitle.textContent = title;
  runStatusDetail.textContent = detail;
}

function showToast(message, kind = "success") {
  if (!toastRegion || !message) return;
  const toast = document.createElement("div");
  toast.className = `toast ${kind === "success" ? "" : kind}`.trim();
  toast.textContent = String(message);
  toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), kind === "error" ? 7000 : 4200);
}

function setActiveSection(sectionName) {
  const requested = String(sectionName || "studio");
  const target =
    document.body.classList.contains("local-mode") && ["apis", "network"].includes(requested) ? "studio" : requested;
  sectionTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.section === target));
  workspaceSections.forEach((section) => {
    const active = section.id === `section-${target}`;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLocalMode(active) {
  const enabled = Boolean(active);
  document.body.classList.toggle("local-mode", enabled);
  localModeBadge.hidden = !enabled;
}

function updateConnection(online, detail) {
  if (!appConnectionStatus) return;
  appConnectionStatus.className = `connection-status ${online ? "online" : "offline"}`;
  appConnectionStatus.lastChild.textContent = ` ${detail}`;
}

function updateRunStatusFromRun(run) {
  if (!run || run.id !== selectedRunId) return;
  const script = run.scriptName || "automation";
  if (run.status === "queued") {
    setRunStatus("queued", "Run queued", `${script} is waiting for an available browser slot.`);
  } else if (run.status === "running") {
    setRunStatus("running", "Run in progress", `${script} is currently executing in a browser.`);
  } else if (run.status === "done") {
    setRunStatus("success", "Run completed", `${script} completed successfully. Inspect logs or start another run.`);
  } else if (run.status === "failed") {
    setRunStatus("error", "Run failed", `${script} failed. Inspect execution logs for the full error.`);
  } else if (run.status === "stopped") {
    setRunStatus("idle", "Run stopped", `${script} was stopped before completion.`);
  }
}

function normalizeBrowserEngine(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "chrome" || raw === "camoufox") return raw;
  return "chromium";
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = n;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[idx]}`;
}

function formatPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n.toFixed(1)}%`;
}

async function copyFromElement(targetId, btn) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const text = el.textContent || "";
  const old = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied";
  } catch {
    btn.textContent = "Copy failed";
  }
  setTimeout(() => {
    btn.textContent = old;
  }, 1000);
}

function statusClass(status) {
  if (status === "running") return "running";
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (status === "stopped") return "stopped";
  return "queued";
}

async function loadConfig() {
  const cfg = await fetchJson("/api/config");
  profileName.value = cfg.profileName || "default";
  browserEngine.value = normalizeBrowserEngine(cfg.browserEngine);
  proxy.value = cfg.proxy || "";
  userAgent.value = cfg.userAgent || "";
  viewportWidth.value = Number(cfg.viewportWidth) || 1440;
  viewportHeight.value = Number(cfg.viewportHeight) || 900;
  localeInput.value = cfg.locale || "en-US";
  timezoneInput.value = cfg.timezoneId || "America/Chicago";
  timeoutMs.value = Number(cfg.timeoutMs) || 120000;
  rotateProfileEveryNRequests.value = Math.max(0, Number(cfg.rotateProfileEveryNRequests) || 0);
  maxConcurrentRunSlots.value = Math.max(1, Number(cfg.maxConcurrentRunSlots) || 4);
  maxQueuedRunSlots.value = Math.max(1, Number(cfg.maxQueuedRunSlots) || 200);
  safeModeMinFreeRamGb.value = Math.max(1, Number(cfg.safeModeMinFreeRamGb) || 4);
  browserJobTimeoutMs.value = Math.max(10000, Number(cfg.browserJobTimeoutMs) || 180000);
  camoufoxSharedIdleMs.value = Math.max(5000, Number(cfg.camoufoxSharedIdleMs) || 30000);
  headless.checked = Boolean(cfg.headless);
  advancedFingerprintMode.checked = cfg.advancedFingerprintMode !== false;
  usePlaywrightWithFingerprints.checked = cfg.usePlaywrightWithFingerprints !== false;
  measureTrafficUsage.checked = Boolean(cfg.measureTrafficUsage);
  keepBrowserOpenOnFinish.checked = Boolean(cfg.keepBrowserOpenOnFinish);
  rotateFingerprintWithProfile.checked = Boolean(cfg.rotateFingerprintWithProfile);
  safeModeEnabled.checked = Boolean(cfg.safeModeEnabled);
  mcpAccessToken.value = cfg.mcpAccessToken || "";
}

async function loadMetrics() {
  try {
    const m = await fetchJson("/api/metrics");
    updateConnection(true, "Server connected");
    setLocalMode(m?.localMode);
    metricProcesses.textContent = String(m?.processes?.active ?? m?.runs?.activeRunSlots ?? 0);
    metricQueue.textContent = `queued: ${String(m?.processes?.queued ?? m?.runs?.queuedRunSlots ?? 0)}`;

    metricCpu.textContent = formatPercent(m?.cpu?.systemPercent);
    metricCpuSub.textContent = `node: ${formatPercent(m?.cpu?.processPercent)} | cores: ${Number(m?.cpu?.cores || 0)}`;

    metricRam.textContent = `${formatPercent(m?.ram?.usedPercent)} (${formatBytes(m?.ram?.usedBytes)})`;
    metricRamSub.textContent = `node RSS: ${formatBytes(m?.ram?.processRssBytes)}`;

    if (m?.gpu?.available) {
      metricGpu.textContent = formatPercent(m?.gpu?.utilizationPercent);
      metricGpuSub.textContent = `mem: ${formatPercent(m?.gpu?.memoryUsedPercent)} (${Number(m?.gpu?.memoryUsedMiB || 0).toFixed(0)} / ${Number(m?.gpu?.memoryTotalMiB || 0).toFixed(0)} MiB)`;
    } else {
      metricGpu.textContent = "N/A";
      metricGpuSub.textContent = "No NVIDIA GPU stats";
    }

    if (m?.disk) {
      metricDisk.textContent = formatPercent(m.disk.usedPercent);
      metricDiskSub.textContent = `used: ${formatBytes(m.disk.usedBytes)} / ${formatBytes(m.disk.totalBytes)}`;
    } else {
      metricDisk.textContent = "N/A";
      metricDiskSub.textContent = "Disk stats unavailable";
    }
  } catch {
    updateConnection(false, "Server unavailable");
    metricProcesses.textContent = "-";
    metricQueue.textContent = "queued: -";
    metricCpu.textContent = "-";
    metricCpuSub.textContent = "node: -";
    metricRam.textContent = "-";
    metricRamSub.textContent = "node RSS: -";
    metricGpu.textContent = "-";
    metricGpuSub.textContent = "mem: -";
    metricDisk.textContent = "-";
    metricDiskSub.textContent = "used: -";
  }
}

async function loadPresets() {
  presets = await fetchJson("/api/fingerprint-presets");
  fingerprintPreset.innerHTML = [
    `<option value="">Select preset...</option>`,
    ...presets.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)}</option>`)
  ].join("");
}

function applySelectedPreset() {
  const id = fingerprintPreset.value;
  if (!id) return;
  const preset = presets.find((p) => p.id === id);
  if (!preset) return;

  userAgent.value = preset.userAgent || "";
  viewportWidth.value = Number(preset.viewportWidth) || 1440;
  viewportHeight.value = Number(preset.viewportHeight) || 900;
  localeInput.value = preset.locale || "en-US";
  timezoneInput.value = preset.timezoneId || "America/Chicago";
}

async function saveConfig() {
  return await fetchJson("/api/config", {
    method: "POST",
    body: JSON.stringify({
      profileName: profileName.value.trim() || "default",
      browserEngine: normalizeBrowserEngine(browserEngine.value),
      proxy: proxy.value.trim(),
      userAgent: userAgent.value,
      viewportWidth: Number(viewportWidth.value) || 1440,
      viewportHeight: Number(viewportHeight.value) || 900,
      locale: localeInput.value.trim() || "en-US",
      timezoneId: timezoneInput.value.trim() || "America/Chicago",
      timeoutMs: Number(timeoutMs.value) || 120000,
      rotateProfileEveryNRequests: Math.max(0, Number(rotateProfileEveryNRequests.value) || 0),
      maxConcurrentRunSlots: Math.max(1, Number(maxConcurrentRunSlots.value) || 4),
      maxQueuedRunSlots: Math.max(1, Number(maxQueuedRunSlots.value) || 200),
      safeModeMinFreeRamGb: Math.max(1, Number(safeModeMinFreeRamGb.value) || 4),
      browserJobTimeoutMs: Math.max(10000, Number(browserJobTimeoutMs.value) || 180000),
      camoufoxSharedIdleMs: Math.max(5000, Number(camoufoxSharedIdleMs.value) || 30000),
      headless: headless.checked,
      advancedFingerprintMode: advancedFingerprintMode.checked,
      usePlaywrightWithFingerprints: usePlaywrightWithFingerprints.checked,
      measureTrafficUsage: measureTrafficUsage.checked,
      keepBrowserOpenOnFinish: keepBrowserOpenOnFinish.checked,
      rotateFingerprintWithProfile: rotateFingerprintWithProfile.checked,
      safeModeEnabled: safeModeEnabled.checked,
      mcpAccessToken: mcpAccessToken.value.trim()
    })
  });
}

let latestMcpDetails = null;

async function loadMcpDetails() {
  const details = await fetchJson("/api/mcp/config");
  latestMcpDetails = details;
  mcpEndpoint.value = details.endpoint || "";
  if (!mcpAccessToken.value && details.token) mcpAccessToken.value = details.token;
  mcpSetupResult.textContent = details.enabled
    ? "Remote MCP is enabled. Keep this token private."
    : "Generate a token, then copy the ready-to-paste MCP configuration.";
  return details;
}

async function copyMcpText(value, button, successText) {
  if (!value) throw new Error("Nothing is available to copy yet.");
  const oldText = button.textContent;
  await navigator.clipboard.writeText(value);
  button.textContent = successText;
  setTimeout(() => {
    button.textContent = oldText;
  }, 1200);
}

async function generateMcpToken() {
  if (mcpAccessToken.value && !confirm("Generate a new token? Existing remote MCP clients will stop working.")) return;
  const details = await fetchJson("/api/mcp/token", { method: "POST", body: "{}" });
  mcpAccessToken.value = details.token || "";
  latestMcpDetails = details;
  mcpEndpoint.value = details.endpoint || "";
  mcpSetupResult.textContent = "New remote MCP token generated. Copy the configuration into your MCP client.";
}

async function copyRemoteMcpConfig() {
  const details = latestMcpDetails || (await loadMcpDetails());
  if (!details.enabled) throw new Error("Generate and save an MCP access token first.");
  await copyMcpText(JSON.stringify(details.mcpRemoteConfig, null, 2), copyMcpConfigBtn, "Config copied");
}

async function recreateProfile() {
  const name = profileName.value.trim() || "default";
  if (!confirm(`Recreate profile "${name}"? This deletes saved cookies/storage for that profile.`)) return;
  await fetchJson("/api/profile/recreate", {
    method: "POST",
    body: JSON.stringify({ profileName: name })
  });
  proxyTestResult.textContent = `Profile "${name}" recreated.`;
}

async function testProxy() {
  const value = proxy.value.trim();
  if (!value) {
    proxyTestResult.textContent = "Enter a proxy first.";
    return;
  }

  proxyTestResult.textContent = "Testing proxy...";
  try {
    const result = await fetchJson("/api/config/proxy/test", {
      method: "POST",
      body: JSON.stringify({ proxy: value })
    });
    if (result.ok) {
      proxyTestResult.textContent = `OK via ${result.protocol} (${result.durationMs}ms, status ${result.status})`;
    } else {
      proxyTestResult.textContent = `Failed: ${result.error || "unknown"}`;
    }
  } catch (err) {
    proxyTestResult.textContent = err.message;
  }
}

async function loadScripts() {
  const scripts = await fetchJson("/api/scripts");
  availableScriptNames = scripts;
  renderApiScriptOptions(apiScriptName.value || activeScript);
  scriptsList.innerHTML = scripts
    .map((name) => {
      const active = name === activeScript ? " active" : "";
      return `<button class="script-item${active}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
    })
    .join("");

  if (!activeScript && scripts.length) {
    await openScript(scripts[0]);
  }

  if (!scripts.length) {
    activeScript = null;
    currentScriptTitle.textContent = "No API code selected";
    scriptEditor.value = "";
  }
}

async function openScript(name) {
  const data = await fetchJson(`/api/scripts/${encodeURIComponent(name)}`);
  activeScript = data.name;
  currentScriptTitle.textContent = data.name;
  scriptEditor.value = data.content;
  await loadScripts();
}

async function saveScript() {
  if (!activeScript) return;
  await fetchJson(`/api/scripts/${encodeURIComponent(activeScript)}`, {
    method: "PUT",
    body: JSON.stringify({ content: scriptEditor.value })
  });
}

function normalizeUploadName(name) {
  const base = String(name || "uploaded_script.js")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .trim();
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe) return "uploaded_script.js";
  return safe.endsWith(".js") ? safe : `${safe}.js`;
}

async function downloadScript() {
  if (!activeScript) return;
  const name = normalizeUploadName(activeScript);
  const blob = new Blob([scriptEditor.value || ""], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function triggerUploadScript() {
  uploadScriptInput.value = "";
  uploadScriptInput.click();
}

async function handleUploadScriptFile() {
  const file = uploadScriptInput.files && uploadScriptInput.files[0];
  if (!file) return;

  const name = normalizeUploadName(file.name);
  const content = await file.text();
  const existing = await fetchJson("/api/scripts");
  if (existing.includes(name)) {
    const ok = confirm(`Script "${name}" already exists. Overwrite it?`);
    if (!ok) return;
  }

  await fetchJson(`/api/scripts/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify({ content })
  });

  activeScript = name;
  await loadScripts();
  await openScript(name);
}

async function createScript() {
  const input = prompt("Script file name", "new_script.js");
  if (!input) return;
  const name = input.trim();
  if (!name) return;

  await fetchJson(`/api/scripts/${encodeURIComponent(name)}`, {
    method: "PUT",
    body: JSON.stringify({ content: "// Write your Playwright automation here\n" })
  });
  activeScript = name.endsWith(".js") ? name : `${name}.js`;
  await loadScripts();
  await openScript(activeScript);
}

async function deleteScript() {
  if (!activeScript) return;
  if (!confirm(`Delete ${activeScript}?`)) return;

  await fetchJson(`/api/scripts/${encodeURIComponent(activeScript)}`, { method: "DELETE" });
  activeScript = null;
  await loadScripts();
}

async function runScript() {
  if (!activeScript) {
    const message = "Select or create API code before running it.";
    setRunStatus("error", "No code selected", message);
    showToast(message, "error");
    return;
  }

  setButtonLoading(runScriptBtn, true, "Queueing...");
  setRunStatus("queued", "Saving and queueing", `${activeScript} is being saved before its browser run starts.`);
  try {
    await saveScript();
    const input = collectSyncInputs();
    const result = await fetchJson("/api/scripts/run", {
      method: "POST",
      body: JSON.stringify({ name: activeScript, input })
    });

    selectedRunId = result.run?.id || null;
    if (!selectedRunId) throw new Error("The server did not return a run ID.");
    updateRunStatusFromRun(result.run);
    showToast(`${activeScript} queued successfully.`);
    await loadRuns();
  } catch (err) {
    const message = errorMessage(err);
    runLogs.textContent = `ERROR:\n${message}`;
    setRunStatus("error", "Could not start run", message);
    showToast(`Run failed to start: ${message}`, "error");
  } finally {
    setButtonLoading(runScriptBtn, false);
  }
}

function addSyncInputRow(key = "", value = "") {
  const row = document.createElement("div");
  row.className = "sync-row";
  row.innerHTML = `
    <input class="sync-key" placeholder="key (e.g. var)" value="${escapeHtml(key)}" />
    <input class="sync-value" placeholder="value" value="${escapeHtml(value)}" />
    <button class="ghost danger sync-remove" type="button">Remove</button>
  `;
  syncInputsList.appendChild(row);
}

function collectSyncInputs() {
  const query = {};
  const rows = syncInputsList.querySelectorAll(".sync-row");
  rows.forEach((row) => {
    const key = row.querySelector(".sync-key")?.value?.trim();
    const value = row.querySelector(".sync-value")?.value ?? "";
    if (!key) return;
    query[key] = value;
  });
  return query;
}

async function runSyncTest() {
  if (!activeScript) {
    const message = "Select or create API code before running a sync test.";
    syncResult.textContent = message;
    setRunStatus("error", "No code selected", message);
    showToast(message, "error");
    return;
  }

  setButtonLoading(runSyncBtn, true, "Running...");
  setRunStatus("running", "Sync test in progress", `${activeScript} is executing and will return JSON directly.`);
  syncResult.textContent = "Starting sync test...";
  try {
    await saveScript();
    const params = new URLSearchParams();
    params.set("scriptName", activeScript);
    const input = collectSyncInputs();
    Object.entries(input).forEach(([k, v]) => params.set(k, v));
    if (syncIncludeLogs.checked) params.set("includeLogs", "true");

    const url = `/api/run-sync?${params.toString()}`;
    const response = await fetch(url);
    const text = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
      syncResult.textContent = JSON.stringify(parsed, null, 2);
    } catch {
      syncResult.textContent = text;
    }
    if (!response.ok || parsed?.ok === false) {
      throw new Error(parsed?.error || text || `Request failed: ${response.status}`);
    }
    setRunStatus("success", "Sync test completed", `${activeScript} returned a response. See the JSON result below.`);
    showToast(`${activeScript} sync test completed.`);
  } catch (err) {
    const message = errorMessage(err);
    syncResult.textContent = `ERROR:\n${message}`;
    setRunStatus("error", "Sync test failed", message);
    showToast(`Sync test failed: ${message}`, "error");
  } finally {
    setButtonLoading(runSyncBtn, false);
  }
}

async function loadRuns() {
  const runs = await fetchJson("/api/runs");
  runsList.innerHTML = runs
    .map((run) => {
      const isActive = run.id === selectedRunId ? " active" : "";
      const stopBtn = run.status === "running" ? `<button class="ghost small stop-run" data-id="${run.id}">Stop</button>` : "";
      const trafficText =
        run.traffic && typeof run.traffic.megabytes === "number"
          ? ` • traffic ${escapeHtml(String(run.traffic.megabytes))} MB`
          : "";
      return `
        <div class="run-item${isActive}" data-id="${run.id}">
          <div>
            <div><strong>${escapeHtml(run.scriptName)}</strong></div>
            <div class="muted">${escapeHtml(run.id)} • ${escapeHtml(run.startedAt)}${trafficText}</div>
          </div>
          <div class="row">
            <span class="status ${statusClass(run.status)}">${escapeHtml(run.status)}</span>
            ${stopBtn}
          </div>
        </div>
      `;
    })
    .join("");

  if (!selectedRunId && runs.length) {
    selectedRunId = runs[0].id;
  }

  if (selectedRunId) {
    updateRunStatusFromRun(runs.find((run) => run.id === selectedRunId));
    await loadRunLogs(selectedRunId);
  } else {
    runLogs.textContent = "";
  }
}

async function clearRuns() {
  if (!confirm("Clear all run history and close kept-open run browsers?")) return;
  await fetchJson("/api/runs/clear", { method: "POST" });
  selectedRunId = null;
  runLogs.textContent = "";
  await loadRuns();
}

async function loadRunLogs(runId) {
  try {
    const run = await fetchJson(`/api/runs/${encodeURIComponent(runId)}`);
    const lines = run.logs.map((l) => `[${l.ts}] ${l.line}`).join("\n");
    runLogs.textContent = lines;
    if (run.error) {
      runLogs.textContent += `\n\nERROR:\n${run.error}`;
    }
  } catch (err) {
    runLogs.textContent = err.message;
  }
}

async function stopRun(runId) {
  await fetchJson(`/api/runs/${encodeURIComponent(runId)}/stop`, { method: "POST" });
  await loadRuns();
}

function platformErrorMessage(err) {
  const raw = err?.message || String(err);
  try {
    const parsed = JSON.parse(raw);
    return parsed.error || raw;
  } catch {
    return raw;
  }
}

function apiOrigin() {
  return window.location.origin || "http://localhost:4300";
}

function documentationExampleValue(field) {
  if (field?.default !== null && field?.default !== undefined && field.default !== "") return field.default;
  if (field?.type === "number") return 1;
  if (field?.type === "boolean") return true;
  if (field?.type === "json") return { example: field.name };
  return `example-${field?.name || "value"}`;
}

function documentationExampleInput(api) {
  return Object.fromEntries(
    (Array.isArray(api?.inputSchema) ? api.inputSchema : []).map((field) => [field.name, documentationExampleValue(field)])
  );
}

function setDocumentationText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function resolveDocumentationApi(api = null) {
  return api || platformApis.find((item) => item.id === editingApiId.value) || platformApis[0] || null;
}

function renderGenericDocumentation(api = null) {
  const origin = apiOrigin();
  const endpoint = api ? `${origin}/v1/${api.slug}` : `${origin}/v1/<api-slug>`;
  const exampleInput = api ? documentationExampleInput(api) : { input_name: "example" };
  const query = new URLSearchParams(exampleInput).toString();
  if (docsBaseUrl) docsBaseUrl.textContent = origin;
  genericPublicApiDocs?.classList.toggle("hidden", Boolean(api));
  setDocumentationText(
    "doc-public-api",
    [
      `curl -X POST "${endpoint}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${JSON.stringify(exampleInput)}'`,
      "",
      `curl "${endpoint}?${query}"`
    ].join("\n")
  );
  setDocumentationText(
    "doc-run-sync",
    `curl "${origin}/api/run-sync?scriptName=ai_overview.js&request=closest%20planet&noProxy=true&includeLogs=true"`
  );
  setDocumentationText(
    "doc-run-async",
    [
      `curl -X POST "${origin}/api/scripts/run" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"name":"ai_overview.js","input":{"request":"closest planet to earth","noProxy":true}}'`
    ].join("\n")
  );
  setDocumentationText(
    "doc-runs-list",
    `curl "${origin}/api/runs"\ncurl "${origin}/api/runs/<runId>"\ncurl -X POST "${origin}/api/runs/<runId>/stop"`
  );
}

function renderSelectedApiDocumentation(api, documentation = null) {
  const endpoint = documentation?.endpoint || `${apiOrigin()}/v1/${api.slug}`;
  const input = documentation?.example?.input || documentationExampleInput(api);
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    params.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  });
  const getUrl = documentation?.example?.getUrl || (params.size ? `${endpoint}?${params.toString()}` : endpoint);
  selectedApiDocsTitle.textContent = `${documentation?.api?.name || api.name} API`;
  selectedApiDocsTarget.textContent = documentation?.api?.targetDomain || api.targetDomain || "Not configured";
  selectedApiDocsEndpoint.textContent = endpoint;
  selectedApiDocsJson.href = documentation?.documentationEndpoint || `${endpoint}/docs`;
  selectedApiDocsGet.textContent = documentation?.example?.curl?.get || `curl "${getUrl}"`;
  selectedApiDocsPost.textContent =
    documentation?.example?.curl?.post ||
    [
      `curl -X POST "${endpoint}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${JSON.stringify(input)}'`
    ].join("\n");
  selectedApiDocs.classList.remove("hidden");
}

async function openApiDocumentation(api = null) {
  const documentedApi = resolveDocumentationApi(api);
  renderGenericDocumentation(documentedApi);
  if (documentedApi) {
    renderSelectedApiDocumentation(documentedApi);
  } else {
    selectedApiDocs.classList.add("hidden");
  }
  apiDocsModal.classList.remove("hidden");

  if (!documentedApi) return;
  try {
    const documentation = await fetchJson(`/v1/${encodeURIComponent(documentedApi.slug)}/docs`);
    renderSelectedApiDocumentation(documentedApi, documentation);
  } catch (err) {
    console.warn("Could not load generated API documentation:", err);
  }
}

function renderApiScriptOptions(selected = "") {
  const selectedName = selected || activeScript || availableScriptNames[0] || "";
  apiScriptName.innerHTML = availableScriptNames.length
    ? availableScriptNames
        .map(
          (name) =>
            `<option value="${escapeHtml(name)}"${name === selectedName ? " selected" : ""}>${escapeHtml(name)}</option>`
        )
        .join("")
    : `<option value="">No API code available</option>`;
}

function addApiInputField(field = {}) {
  const row = document.createElement("div");
  row.className = "input-schema-row";
  const defaultValue =
    field.default === null || field.default === undefined
      ? ""
      : typeof field.default === "object"
      ? JSON.stringify(field.default)
      : String(field.default);
  row.innerHTML = `
    <input class="api-input-name" placeholder="name" value="${escapeHtml(field.name || "")}" />
    <select class="api-input-type">
      ${["string", "number", "boolean", "json"]
        .map((type) => `<option value="${type}"${field.type === type ? " selected" : ""}>${type}</option>`)
        .join("")}
    </select>
    <label class="checkbox"><input class="api-input-required" type="checkbox"${field.required ? " checked" : ""} /><span>Required</span></label>
    <input class="api-input-default" placeholder="default" value="${escapeHtml(defaultValue)}" />
    <input class="api-input-description" placeholder="description" value="${escapeHtml(field.description || "")}" />
    <button class="ghost danger small api-input-remove" type="button">Remove</button>
  `;
  apiInputFields.appendChild(row);
}

function collectApiInputSchema() {
  return [...apiInputFields.querySelectorAll(".input-schema-row")]
    .map((row) => {
      const name = row.querySelector(".api-input-name")?.value?.trim();
      if (!name) return null;
      const type = row.querySelector(".api-input-type")?.value || "string";
      const defaultText = row.querySelector(".api-input-default")?.value ?? "";
      let defaultValue = defaultText === "" ? null : defaultText;
      if (type === "json" && defaultText) {
        try {
          defaultValue = JSON.parse(defaultText);
        } catch {
          throw new Error(`Default for ${name} must be valid JSON.`);
        }
      }
      return {
        name,
        type,
        required: Boolean(row.querySelector(".api-input-required")?.checked),
        default: defaultValue,
        description: row.querySelector(".api-input-description")?.value?.trim() || ""
      };
    })
    .filter(Boolean);
}

function renderApiAssignments(api = null) {
  const selectedPools = new Map((api?.proxyPools || []).map((entry) => [entry.poolId, entry]));
  apiPoolAssignments.innerHTML = platformPools.length
    ? platformPools
        .map((pool) => {
          const assignment = selectedPools.get(pool.id);
          return `
            <div class="assignment-row" data-pool-id="${escapeHtml(pool.id)}">
              <input class="api-pool-enabled" type="checkbox"${assignment?.enabled ? " checked" : ""} />
              <label>${escapeHtml(pool.name)} <span class="muted">${escapeHtml(pool.type)} · ${pool.proxies.length} proxies</span></label>
              <input class="api-pool-rph" type="number" min="1" value="${Number(assignment?.requestsPerHour || 60)}" placeholder="req/hr" title="Requests/hour/proxy" />
              <input class="api-pool-cooldown" type="number" min="1" value="${Number(assignment?.cooldownMinutes || 30)}" placeholder="cooldown" title="Cooldown minutes" />
              <input class="api-pool-failures" type="number" min="1" value="${Number(assignment?.maxConsecutiveFailures || 2)}" placeholder="errors" title="Failures before cooldown" />
            </div>
          `;
        })
        .join("")
    : `<p class="muted">Create a proxy pool first.</p>`;

  const selectedProfiles = new Set((api?.staticProfiles || []).map((profile) => profile.id));
  apiProfileAssignments.innerHTML = platformProfiles.length
    ? platformProfiles
        .map(
          (profile) => `
            <div class="assignment-row profile-assignment-row" data-profile-id="${escapeHtml(profile.id)}">
              <input class="api-profile-enabled" type="checkbox"${selectedProfiles.has(profile.id) ? " checked" : ""} />
              <label>${escapeHtml(profile.name)} <span class="muted">${escapeHtml(profile.browserEngine)} · ${escapeHtml(profile.proxy?.value || "no proxy")}</span></label>
              <span class="muted">${profile.locked ? "in use" : "ready"}</span>
            </div>
          `
        )
        .join("")
    : `<p class="muted">Create a static profile first.</p>`;
}

function collectApiPoolAssignments() {
  return [...apiPoolAssignments.querySelectorAll("[data-pool-id]")]
    .filter((row) => row.querySelector(".api-pool-enabled")?.checked)
    .map((row) => ({
      poolId: row.dataset.poolId,
      enabled: true,
      requestsPerHour: Number(row.querySelector(".api-pool-rph")?.value) || 60,
      cooldownMinutes: Number(row.querySelector(".api-pool-cooldown")?.value) || 30,
      maxConsecutiveFailures: Number(row.querySelector(".api-pool-failures")?.value) || 2
    }));
}

function collectApiProfileIds() {
  return [...apiProfileAssignments.querySelectorAll("[data-profile-id]")]
    .filter((row) => row.querySelector(".api-profile-enabled")?.checked)
    .map((row) => row.dataset.profileId);
}

function resetApiEditor() {
  editingApiId.value = "";
  apiEditorTitle.textContent = "Create API";
  apiEndpoint.textContent = "Save to generate endpoint";
  openApiDocsBtn.disabled = true;
  apiName.value = "";
  apiSlug.value = "";
  renderApiScriptOptions(activeScript);
  apiTargetDomain.value = "";
  apiInputFields.innerHTML = "";
  apiMaxConcurrentRuns.value = "1";
  apiMaxQueuedRequests.value = "100";
  apiProfileMode.value = "DISPOSABLE";
  apiDisposableMaxRequests.value = "1";
  apiDisposableRetention.value = "0";
  apiEnabled.checked = true;
  apiEditorResult.textContent = "";
  renderApiAssignments(null);
}

function editApi(api) {
  editingApiId.value = api.id;
  apiEditorTitle.textContent = `Edit: ${api.name}`;
  apiEndpoint.textContent = `${apiOrigin()}/v1/${api.slug}`;
  openApiDocsBtn.disabled = false;
  apiName.value = api.name;
  apiSlug.value = api.slug;
  renderApiScriptOptions(api.scriptName);
  apiTargetDomain.value = api.targetDomain;
  apiInputFields.innerHTML = "";
  (api.inputSchema || []).forEach((field) => addApiInputField(field));
  apiMaxConcurrentRuns.value = String(api.maxConcurrentRuns || 1);
  apiMaxQueuedRequests.value = String(api.maxQueuedRequests ?? 100);
  apiProfileMode.value = api.profileMode || "DISPOSABLE";
  apiDisposableMaxRequests.value = String(api.disposableProfileMaxRequests || 1);
  apiDisposableRetention.value = String(api.disposableProfileRetentionMinutes || 0);
  apiEnabled.checked = Boolean(api.enabled);
  apiEditorResult.textContent = `Capacity: ${api.hourlyCapacity || 0}/hour, ${api.ratePerMinute || 0}/minute, ${api.ratePerSecond || 0}/second. Used this hour: ${api.usedThisHour || 0}.`;
  renderApiAssignments(api);
  renderApisList();
}

function renderApisList() {
  const selectedId = editingApiId.value;
  apisList.innerHTML = platformApis.length
    ? platformApis
        .map(
          (api) => `
            <div class="manager-item${api.id === selectedId ? " active" : ""}">
              <div class="manager-item-head">
                <strong>${escapeHtml(api.name)}</strong>
                <span class="status ${api.enabled ? "done" : "failed"}">${api.enabled ? "enabled" : "disabled"}</span>
              </div>
              <code>/v1/${escapeHtml(api.slug)}</code>
              <div class="muted">${escapeHtml(api.targetDomain)} · ${api.hourlyCapacity || 0}/hr · ${api.ratePerMinute || 0}/min · ${api.maxConcurrentRuns} browsers</div>
              <div class="manager-actions api-list-actions">
                <button class="ghost small open-api" data-id="${escapeHtml(api.id)}">Edit</button>
                <button class="ghost small api-docs" data-id="${escapeHtml(api.id)}">Docs</button>
              </div>
            </div>
          `
        )
        .join("")
    : `<p class="muted">No published APIs yet. Create one from API code.</p>`;
}

function renderProxyPools() {
  const proxyOptions = platformPools.flatMap((pool) =>
    pool.proxies.map(
      (entry) =>
        `<option value="${escapeHtml(entry.id)}">${escapeHtml(pool.name)} · ${escapeHtml(entry.value)}</option>`
    )
  );
  staticProfileProxy.innerHTML = proxyOptions.length
    ? `<option value="">Select fixed proxy...</option>${proxyOptions.join("")}`
    : `<option value="">Create a proxy pool first</option>`;

  proxyPoolsList.innerHTML = platformPools.length
    ? platformPools
        .map((pool) => {
          const proxies = pool.proxies.length
            ? pool.proxies
                .map((entry) => {
                  const health = entry.health;
                  const healthText = health?.cooling
                    ? `cooling until ${new Date(health.cooldownUntil).toLocaleTimeString()}`
                    : health?.totalFailureCount
                    ? `${health.totalFailureCount} failures${health.lastError ? `: ${health.lastError}` : ""}`
                    : "healthy";
                  const healthClass = health?.cooling || health?.totalFailureCount ? "health-bad" : "health-good";
                  return `
                    <div class="proxy-row">
                      <div>
                        <code>${escapeHtml(entry.value)}</code>
                        <div class="muted ${healthClass}">${escapeHtml(healthText)} · ${health?.requestCount || 0} used this hour</div>
                      </div>
                      <button class="ghost danger small delete-proxy" data-id="${escapeHtml(entry.id)}">Remove</button>
                    </div>
                  `;
                })
                .join("")
            : `<p class="muted">No proxies in this pool.</p>`;
          return `
            <div class="manager-item">
              <div class="manager-item-head">
                <strong>${escapeHtml(pool.name)}</strong>
                <span class="status ${pool.type === "DYNAMIC" ? "running" : "done"}">${escapeHtml(pool.type)}</span>
              </div>
              <div class="muted">${escapeHtml(pool.description || "No description")} · assigned to ${pool.apiCount} APIs</div>
              <div class="proxy-list">${proxies}</div>
              <div class="row manager-actions">
                <button class="ghost small add-pool-proxies" data-id="${escapeHtml(pool.id)}">Add Proxies</button>
                <button class="ghost danger small delete-pool" data-id="${escapeHtml(pool.id)}">Delete Pool</button>
              </div>
            </div>
          `;
        })
        .join("")
    : `<p class="muted">No proxy pools yet.</p>`;
}

function renderStaticProfiles() {
  staticProfilePreset.innerHTML = [
    `<option value="">Use current browser setup</option>`,
    ...presets.map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</option>`)
  ].join("");
  staticProfilesList.innerHTML = platformProfiles.length
    ? platformProfiles
        .map(
          (profile) => `
            <div class="manager-item">
              <div class="manager-item-head">
                <strong>${escapeHtml(profile.name)}</strong>
                <span class="status ${profile.locked ? "running" : profile.enabled ? "done" : "failed"}">${profile.locked ? "in use" : profile.enabled ? "ready" : "disabled"}</span>
              </div>
              <div class="muted">${escapeHtml(profile.browserEngine)} · ${escapeHtml(profile.proxy?.value || "missing proxy")}</div>
              <div class="muted">used ${profile.requestCount} times · assigned to ${profile.apiCount} APIs</div>
              <div class="row manager-actions">
                <button class="ghost small recreate-static-profile" data-id="${escapeHtml(profile.id)}">Recreate</button>
                <button class="ghost danger small delete-static-profile" data-id="${escapeHtml(profile.id)}">Delete Profile</button>
              </div>
            </div>
          `
        )
        .join("")
    : `<p class="muted">No static profiles yet.</p>`;
}

async function loadApiPlatform({ keepEditor = true } = {}) {
  try {
    const status = await fetchJson("/api/database/status");
    setLocalMode(status.localMode);
    if (!status.configured || !status.connected) {
      databaseStatus.textContent = status.error || "PostgreSQL is unavailable. Set DATABASE_URL and deploy migrations.";
      databaseStatus.className = `muted ${status.localMode ? "" : "health-bad"}`;
      platformApis = [];
      platformPools = [];
      platformProfiles = [];
      renderApisList();
      renderProxyPools();
      renderStaticProfiles();
      if (!keepEditor) resetApiEditor();
      return;
    }
    databaseStatus.textContent = "PostgreSQL connected. API scheduler is ready.";
    databaseStatus.className = "muted health-good";
    const [apis, pools, profiles] = await Promise.all([
      fetchJson("/api/apis"),
      fetchJson("/api/proxy-pools"),
      fetchJson("/api/profiles")
    ]);
    platformApis = apis;
    platformPools = pools;
    platformProfiles = profiles;
    renderProxyPools();
    renderStaticProfiles();
    const selected = platformApis.find((api) => api.id === editingApiId.value);
    if (selected && keepEditor) editApi(selected);
    else resetApiEditor();
    renderApisList();
  } catch (err) {
    databaseStatus.textContent = platformErrorMessage(err);
    databaseStatus.className = "muted health-bad";
  }
}

async function saveApi() {
  try {
    const inputSchema = collectApiInputSchema();
    const body = {
      name: apiName.value.trim(),
      slug: apiSlug.value.trim(),
      scriptName: apiScriptName.value,
      targetDomain: apiTargetDomain.value.trim(),
      inputSchema,
      enabled: apiEnabled.checked,
      maxConcurrentRuns: Number(apiMaxConcurrentRuns.value) || 1,
      maxQueuedRequests: Number(apiMaxQueuedRequests.value) || 100,
      profileMode: apiProfileMode.value,
      disposableProfileMaxRequests: Number(apiDisposableMaxRequests.value) || 1,
      disposableProfileRetentionMinutes: Number(apiDisposableRetention.value) || 0
    };
    const api = editingApiId.value
      ? await fetchJson(`/api/apis/${encodeURIComponent(editingApiId.value)}`, { method: "PUT", body: JSON.stringify(body) })
      : await fetchJson("/api/apis", { method: "POST", body: JSON.stringify(body) });
    await fetchJson(`/api/apis/${encodeURIComponent(api.id)}/proxy-pools`, {
      method: "PUT",
      body: JSON.stringify({ assignments: collectApiPoolAssignments() })
    });
    await fetchJson(`/api/apis/${encodeURIComponent(api.id)}/profiles`, {
      method: "PUT",
      body: JSON.stringify({ profileIds: collectApiProfileIds() })
    });
    editingApiId.value = api.id;
    apiEditorResult.textContent = `Saved ${api.name}. Endpoint: ${apiOrigin()}/v1/${api.slug}`;
    await loadApiPlatform();
  } catch (err) {
    apiEditorResult.textContent = platformErrorMessage(err);
  }
}

async function deleteCurrentApi() {
  const id = editingApiId.value;
  if (!id || !confirm("Delete this API and its disposable profiles/run history? API code files are kept.")) return;
  try {
    await fetchJson(`/api/apis/${encodeURIComponent(id)}`, { method: "DELETE" });
    resetApiEditor();
    await loadApiPlatform({ keepEditor: false });
  } catch (err) {
    apiEditorResult.textContent = platformErrorMessage(err);
  }
}

async function createPool() {
  try {
    await fetchJson("/api/proxy-pools", {
      method: "POST",
      body: JSON.stringify({
        name: proxyPoolName.value.trim(),
        type: proxyPoolType.value,
        description: proxyPoolDescription.value.trim(),
        proxiesText: proxyPoolProxies.value
      })
    });
    proxyPoolName.value = "";
    proxyPoolDescription.value = "";
    proxyPoolProxies.value = "";
    await loadApiPlatform();
  } catch (err) {
    alert(platformErrorMessage(err));
  }
}

async function createStaticProfile() {
  try {
    await fetchJson("/api/profiles", {
      method: "POST",
      body: JSON.stringify({
        name: staticProfileName.value.trim(),
        proxyId: staticProfileProxy.value,
        browserEngine: staticProfileEngine.value,
        fingerprintPresetId: staticProfilePreset.value || null
      })
    });
    staticProfileName.value = "";
    await loadApiPlatform();
  } catch (err) {
    alert(platformErrorMessage(err));
  }
}

async function importExistingCode() {
  if (!confirm("Create database API records for existing code files? APIs whose target domain cannot be inferred are created disabled.")) return;
  try {
    const result = await fetchJson("/api/database/import-legacy", { method: "POST", body: "{}" });
    apiEditorResult.textContent = `Imported ${result.created} APIs. Skipped ${result.skipped} already-linked code files.`;
    await loadApiPlatform({ keepEditor: false });
  } catch (err) {
    apiEditorResult.textContent = platformErrorMessage(err);
  }
}

scriptsList.addEventListener("click", async (event) => {
  const btn = event.target.closest(".script-item");
  if (!btn) return;
  await openScript(btn.dataset.name);
});

runsList.addEventListener("click", async (event) => {
  const stopBtn = event.target.closest(".stop-run");
  if (stopBtn) {
    await stopRun(stopBtn.dataset.id);
    return;
  }

  const row = event.target.closest(".run-item");
  if (!row) return;
  selectedRunId = row.dataset.id;
  await loadRuns();
});

syncInputsList.addEventListener("click", (event) => {
  const btn = event.target.closest(".sync-remove");
  if (!btn) return;
  const row = btn.closest(".sync-row");
  row?.remove();
});

apisList.addEventListener("click", (event) => {
  const docsButton = event.target.closest(".api-docs");
  if (docsButton) {
    const api = platformApis.find((item) => item.id === docsButton.dataset.id);
    if (api) openApiDocumentation(api);
    return;
  }
  const button = event.target.closest(".open-api");
  if (!button) return;
  const api = platformApis.find((item) => item.id === button.dataset.id);
  if (api) editApi(api);
});

apiInputFields.addEventListener("click", (event) => {
  const button = event.target.closest(".api-input-remove");
  if (!button) return;
  button.closest(".input-schema-row")?.remove();
});

proxyPoolsList.addEventListener("click", async (event) => {
  const proxyButton = event.target.closest(".delete-proxy");
  const poolButton = event.target.closest(".delete-pool");
  const addButton = event.target.closest(".add-pool-proxies");
  try {
    if (proxyButton) {
      if (!confirm("Remove this proxy? Any static profile using it will need a new fixed proxy.")) return;
      await fetchJson(`/api/proxies/${encodeURIComponent(proxyButton.dataset.id)}`, { method: "DELETE" });
      await loadApiPlatform();
      return;
    }
    if (poolButton) {
      if (!confirm("Delete this proxy pool and remove its assignments from APIs?")) return;
      await fetchJson(`/api/proxy-pools/${encodeURIComponent(poolButton.dataset.id)}`, { method: "DELETE" });
      await loadApiPlatform();
      return;
    }
    if (addButton) {
      const proxiesText = prompt("Add proxies, one per line");
      if (!proxiesText) return;
      await fetchJson(`/api/proxy-pools/${encodeURIComponent(addButton.dataset.id)}/proxies`, {
        method: "POST",
        body: JSON.stringify({ proxiesText })
      });
      await loadApiPlatform();
    }
  } catch (err) {
    alert(platformErrorMessage(err));
  }
});

staticProfilesList.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest(".delete-static-profile");
  const recreateButton = event.target.closest(".recreate-static-profile");
  if (!deleteButton && !recreateButton) return;
  try {
    if (recreateButton) {
      const profile = platformProfiles.find((item) => item.id === recreateButton.dataset.id);
      if (!profile || !confirm(`Recreate ${profile.name}? This deletes its saved browser data.`)) return;
      await fetchJson("/api/profile/recreate", {
        method: "POST",
        body: JSON.stringify({ profileName: profile.profileDir })
      });
    } else {
      if (!confirm("Delete this static browser profile and its saved browser data?")) return;
      await fetchJson(`/api/profiles/${encodeURIComponent(deleteButton.dataset.id)}`, { method: "DELETE" });
    }
    await loadApiPlatform();
  } catch (err) {
    alert(platformErrorMessage(err));
  }
});

sectionTabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveSection(tab.dataset.section));
});

newScriptBtn.addEventListener("click", createScript);
downloadScriptBtn.addEventListener("click", downloadScript);
uploadScriptBtn.addEventListener("click", triggerUploadScript);
uploadScriptInput.addEventListener("change", () => {
  handleUploadScriptFile().catch((err) => {
    runLogs.textContent = err?.stack || err?.message || String(err);
  });
});
saveScriptBtn.addEventListener("click", async () => {
  try {
    setButtonLoading(saveScriptBtn, true, "Saving...");
    await saveScript();
    if (activeScript) showToast(`${activeScript} saved.`);
  } catch (err) {
    showToast(`Could not save code: ${errorMessage(err)}`, "error");
  } finally {
    setButtonLoading(saveScriptBtn, false);
  }
});
deleteScriptBtn.addEventListener("click", deleteScript);
runScriptBtn.addEventListener("click", runScript);
saveConfigBtn.addEventListener("click", async () => {
  try {
    setButtonLoading(saveConfigBtn, true, "Saving...");
    await saveConfig();
    await loadMcpDetails();
    showToast("Browser setup saved.");
  } catch (err) {
    const message = errorMessage(err);
    showToast(`Could not save browser setup: ${message}`, "error");
  } finally {
    setButtonLoading(saveConfigBtn, false);
  }
});
testProxyBtn.addEventListener("click", testProxy);
refreshRunsBtn.addEventListener("click", loadRuns);
clearRunsBtn.addEventListener("click", clearRuns);
recreateProfileBtn.addEventListener("click", recreateProfile);
applyPresetBtn.addEventListener("click", applySelectedPreset);
generateMcpTokenBtn.addEventListener("click", async () => {
  try {
    setButtonLoading(generateMcpTokenBtn, true, "Generating...");
    await generateMcpToken();
    showToast("New MCP access token generated.");
  } catch (err) {
    showToast(`Could not generate MCP token: ${errorMessage(err)}`, "error");
  } finally {
    setButtonLoading(generateMcpTokenBtn, false);
  }
});
copyMcpEndpointBtn.addEventListener("click", async () => {
  try {
    await copyMcpText(mcpEndpoint.value, copyMcpEndpointBtn, "URL copied");
  } catch (err) {
    showToast(`Could not copy MCP URL: ${errorMessage(err)}`, "error");
  }
});
copyMcpConfigBtn.addEventListener("click", async () => {
  try {
    await copyRemoteMcpConfig();
  } catch (err) {
    showToast(`Could not copy MCP configuration: ${errorMessage(err)}`, "error");
  }
});
addSyncInputBtn.addEventListener("click", () => addSyncInputRow("", ""));
runSyncBtn.addEventListener("click", runSyncTest);
newApiBtn.addEventListener("click", resetApiEditor);
addApiInputBtn.addEventListener("click", () => addApiInputField());
saveApiBtn.addEventListener("click", saveApi);
deleteApiBtn.addEventListener("click", deleteCurrentApi);
createProxyPoolBtn.addEventListener("click", createPool);
createStaticProfileBtn.addEventListener("click", createStaticProfile);
importLegacyBtn.addEventListener("click", importExistingCode);
apiName.addEventListener("input", () => {
  if (editingApiId.value || apiSlug.value.trim()) return;
  apiSlug.value = apiName.value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
});
apiDocsBtn.addEventListener("click", () => openApiDocumentation());
openApiDocsBtn.addEventListener("click", () => {
  const api = platformApis.find((item) => item.id === editingApiId.value);
  if (api) openApiDocumentation(api);
});
closeApiDocsBtn.addEventListener("click", () => apiDocsModal.classList.add("hidden"));
apiDocsModal.addEventListener("click", (event) => {
  if (event.target === apiDocsModal) {
    apiDocsModal.classList.add("hidden");
    return;
  }
  const btn = event.target.closest(".copy-btn");
  if (!btn) return;
  const targetId = btn.getAttribute("data-copy-target");
  if (!targetId) return;
  copyFromElement(targetId, btn);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") apiDocsModal.classList.add("hidden");
});

async function init() {
  await Promise.all([loadConfig(), loadMcpDetails(), loadPresets(), loadScripts(), loadRuns(), loadMetrics()]);
  addSyncInputRow("var", "");
  addSyncInputRow("var2", "");
  await loadApiPlatform({ keepEditor: false });
  setInterval(() => {
    loadRuns().catch((err) => {
      if (selectedRunId) runLogs.textContent = `Could not refresh run status:\n${errorMessage(err)}`;
    });
  }, 2500);
  setInterval(loadMetrics, 2500);
}

init().catch((err) => {
  const message = errorMessage(err);
  runLogs.textContent = `Unable to initialize the control panel:\n${message}`;
  setRunStatus("error", "Control panel unavailable", message);
  showToast(`Unable to initialize: ${message}`, "error");
});
