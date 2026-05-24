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
const headless = document.getElementById("headless");
const advancedFingerprintMode = document.getElementById("advancedFingerprintMode");
const usePlaywrightWithFingerprints = document.getElementById("usePlaywrightWithFingerprints");
const measureTrafficUsage = document.getElementById("measureTrafficUsage");
const keepBrowserOpenOnFinish = document.getElementById("keepBrowserOpenOnFinish");
const rotateFingerprintWithProfile = document.getElementById("rotateFingerprintWithProfile");
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

let activeScript = null;
let selectedRunId = null;
let presets = [];

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
  headless.checked = Boolean(cfg.headless);
  advancedFingerprintMode.checked = cfg.advancedFingerprintMode !== false;
  usePlaywrightWithFingerprints.checked = cfg.usePlaywrightWithFingerprints !== false;
  measureTrafficUsage.checked = Boolean(cfg.measureTrafficUsage);
  keepBrowserOpenOnFinish.checked = Boolean(cfg.keepBrowserOpenOnFinish);
  rotateFingerprintWithProfile.checked = Boolean(cfg.rotateFingerprintWithProfile);
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
      headless: headless.checked,
      advancedFingerprintMode: advancedFingerprintMode.checked,
      usePlaywrightWithFingerprints: usePlaywrightWithFingerprints.checked,
      measureTrafficUsage: measureTrafficUsage.checked,
      keepBrowserOpenOnFinish: keepBrowserOpenOnFinish.checked,
      rotateFingerprintWithProfile: rotateFingerprintWithProfile.checked
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
    currentScriptTitle.textContent = "No script selected";
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
  await Promise.all([loadConfig(), loadPresets(), loadScripts(), loadRuns()]);
  addSyncInputRow("var", "");
  addSyncInputRow("var2", "");
  setInterval(loadRuns, 2500);
}

init().catch((err) => {
  runLogs.textContent = err?.stack || err?.message || String(err);
});
