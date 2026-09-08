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

const databaseStatus = document.getElementById("databaseStatus");
const importLegacyBtn = document.getElementById("importLegacyBtn");
const newApiBtn = document.getElementById("newApiBtn");
const apisList = document.getElementById("apisList");
const apiEditorTitle = document.getElementById("apiEditorTitle");
const apiEndpoint = document.getElementById("apiEndpoint");
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

let activeScript = null;
let selectedRunId = null;
let presets = [];
let availableScriptNames = [];
let platformApis = [];
let platformPools = [];
let platformProfiles = [];

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
}

async function loadMetrics() {
  try {
    const m = await fetchJson("/api/metrics");
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
  await fetchJson("/api/config", {
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
      safeModeEnabled: safeModeEnabled.checked
    })
  });
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
  if (!activeScript) return;
  await saveScript();
  const input = collectSyncInputs();

  const result = await fetchJson("/api/scripts/run", {
    method: "POST",
    body: JSON.stringify({ name: activeScript, input })
  });

  selectedRunId = result.run?.id || null;
  await loadRuns();
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
    syncResult.textContent = "Select a script first.";
    return;
  }
  await saveScript();

  const params = new URLSearchParams();
  params.set("scriptName", activeScript);
  const input = collectSyncInputs();
  Object.entries(input).forEach(([k, v]) => params.set(k, v));
  if (syncIncludeLogs.checked) params.set("includeLogs", "true");

  const url = `/api/run-sync?${params.toString()}`;
  syncResult.textContent = "Running...";
  try {
    const response = await fetch(url);
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      syncResult.textContent = JSON.stringify(parsed, null, 2);
    } catch {
      syncResult.textContent = text;
    }
  } catch (err) {
    syncResult.textContent = err?.stack || err?.message || String(err);
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
              <button class="ghost small open-api" data-id="${escapeHtml(api.id)}">Edit</button>
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
    if (!status.configured || !status.connected) {
      databaseStatus.textContent = status.error || "PostgreSQL is unavailable. Set DATABASE_URL and deploy migrations.";
      databaseStatus.className = "muted health-bad";
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

newScriptBtn.addEventListener("click", createScript);
downloadScriptBtn.addEventListener("click", downloadScript);
uploadScriptBtn.addEventListener("click", triggerUploadScript);
uploadScriptInput.addEventListener("change", () => {
  handleUploadScriptFile().catch((err) => {
    runLogs.textContent = err?.stack || err?.message || String(err);
  });
});
saveScriptBtn.addEventListener("click", saveScript);
deleteScriptBtn.addEventListener("click", deleteScript);
runScriptBtn.addEventListener("click", runScript);
saveConfigBtn.addEventListener("click", saveConfig);
testProxyBtn.addEventListener("click", testProxy);
refreshRunsBtn.addEventListener("click", loadRuns);
clearRunsBtn.addEventListener("click", clearRuns);
recreateProfileBtn.addEventListener("click", recreateProfile);
applyPresetBtn.addEventListener("click", applySelectedPreset);
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
apiDocsBtn.addEventListener("click", () => apiDocsModal.classList.remove("hidden"));
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
  await Promise.all([loadConfig(), loadPresets(), loadScripts(), loadRuns(), loadMetrics()]);
  addSyncInputRow("var", "");
  addSyncInputRow("var2", "");
  await loadApiPlatform({ keepEditor: false });
  setInterval(loadRuns, 2500);
  setInterval(loadMetrics, 2500);
}

init().catch((err) => {
  runLogs.textContent = err?.stack || err?.message || String(err);
});
