# Browser API Factory

Playwright browser automation that turns browser interfaces into reusable HTTP APIs.

Features:

- API code editor + manual run UI
- published `GET`/`POST` API endpoints backed by browser code
- PostgreSQL/Prisma persistence for APIs, proxy pools, profiles, proxy health, and API run history
- browser engine selection (`chromium`, `chrome`, `camoufox`)
- static and dynamic proxy pools with per-domain, per-proxy hourly limits
- static browser profiles and automatically cleaned disposable profiles
- profile recreation + fingerprint rotation controls
- protected remote MCP endpoint for coding agents

## Requirements

- Ubuntu/Debian local mode: the installer provisions Node.js 22, browsers, and system dependencies.
- PostgreSQL 14+ is only required for the full API Builder, proxy pools, and managed profile platform.
- Coolify/Docker deployment uses full mode and needs PostgreSQL.

## Quick Start

Run the local script studio without PostgreSQL:

```bash
./install_and_run.sh --local --port 4300
```

This will:

1. install Ubuntu build, display, and browser dependencies
2. install Node.js 22 when needed
3. install npm packages, Playwright Chromium, Camoufox, and Google Chrome
4. start the app in local mode on the selected port

Open:

- `http://localhost:4300`

## Local Ubuntu Mode

Local mode is for manually developing and testing scripts. It stores scripts,
settings, profiles, and logs in the local project directories and does **not**
require `DATABASE_URL` or PostgreSQL.

Fresh Ubuntu one-liner (uses the public GitHub repository):

```bash
sudo apt-get update && sudo apt-get install -y git && git clone https://github.com/serhii-samborskyi/browser_automation_tool.git ~/browser_automation_tool && cd ~/browser_automation_tool && chmod +x install_and_run.sh && ./install_and_run.sh --local --port 4300
```

The local UI displays `Local mode · DB off` and hides API Builder and Network
Manager. These capabilities remain available in full mode:

| Available locally | Requires PostgreSQL/full mode |
| --- | --- |
| script editor, upload/download, manual browser runs | published HTTP APIs |
| browser settings, persistent default profile, MCP | proxy pools and rate scheduling |
| Chromium, Chrome, and Camoufox engines | static/disposable managed profiles |

For a visible browser window, run the app from an Ubuntu desktop terminal with
**Headless mode** disabled. Over SSH, the installer uses Xvfb automatically;
headed browser windows run in its virtual display and are not visible.

Ubuntu 26.04 is newer than the current Playwright platform matrix. The
installer automatically downloads and runs Playwright's Ubuntu 24.04-compatible
browser builds on Ubuntu 26.04 x86_64.

## Coolify Deployment

The included `Dockerfile` installs Playwright Chromium/Firefox, Google Chrome,
Camoufox, and Xvfb. It supports all three browser engine options from the UI,
including headed jobs running in the container's virtual display.

1. Create an application from this repository in Coolify.
2. Set the build pack to `Dockerfile` and deploy from the repository root.
3. Set **Ports Exposes** to `3000`.
4. Add a PostgreSQL service in Coolify, then set `DATABASE_URL` to its connection URL.
5. Set `PORT=3000` and `HOST=0.0.0.0` in Coolify. Those are image defaults,
   but declaring them makes the deployment configuration explicit.
6. Add persistent storages with these destination paths:

| Destination | Keeps |
| --- | --- |
| `/app/data` | UI settings, run state, and logs |
| `/app/profile` | browser profiles and cookies |
| `/app/scripts` | scripts saved or uploaded through the UI |
| `/home/node/.cache/camoufox` | Camoufox binary cache |

Do not mount a volume at `/app`; it would hide the application files. On the
first start, the container seeds bundled scripts and the Camoufox binary into
empty persistent storage automatically. When `DATABASE_URL` is present, the
container runs `prisma migrate deploy` before it starts the server. Do not set
`LOCAL_MODE` for Coolify; full mode is the default and retains all
database-backed features.

The Chrome package in this image is for `linux/amd64`. Deploy to an x86_64
Coolify host when using the `chrome` engine. Restrict access to this app: its
API can execute uploaded automation scripts and has no authentication layer.

## PostgreSQL Setup

Set `DATABASE_URL` before enabling API Builder. Example for a local PostgreSQL
database:

```bash
export DATABASE_URL='postgresql://browser_api:password@127.0.0.1:5432/browser_api?schema=public'
npm run db:migrate
npm start
```

Prisma schema and versioned migrations are in `prisma/`. The first startup does
not alter existing code files or browser profiles. Open **API Builder** and use
**Import Existing Code** to create disabled/enabled API records from existing
`.js` files. A target hostname is inferred from `page.goto()` when possible;
otherwise configure it before enabling the API.
If the existing browser setup has a default proxy, import also creates an
`Imported default proxy` pool and assigns it to the new API records.

## Published APIs

Each published API links to one API code file from `scripts/`, declares a target
domain, and defines input fields. The code keeps the existing runtime contract:
input values are available as `input.<field>`, and its returned value becomes
the JSON `result` in the HTTP response.

Create an API in the UI, then call it directly:

```bash
curl -X POST "http://localhost:4300/v1/google-results" \
  -H "Content-Type: application/json" \
  -d '{"search_request":"closest planet to earth"}'

curl "http://localhost:4300/v1/google-results?search_request=closest%20planet%20to%20earth"
```

The API response contains `result` from the code and a `meta` object with the
run duration, traffic measurement, selected pool, and browser profile. Proxy
credentials are never included in the public response.

There is intentionally no API authentication because this deployment was
requested without it. Keep the application private or behind your own network
access control before exposing it beyond trusted callers.

## Proxy Scheduling

Create one or more proxy pools and assign multiple pools to an API.
The scheduler combines their available capacity and chooses the eligible proxy
with the lowest request count for that API and target domain.
API Builder displays the combined hourly, per-minute, and per-second capacity
for every published API.

- Static pool: upload one proxy per line. Every proxy adds its own request/hour capacity.
- Dynamic pool: contains exactly one rotating proxy endpoint. It counts as one logical proxy, even when its external IP changes per request.
- Each API-to-pool assignment sets requests/hour/proxy, cooldown minutes, and error threshold.
- Every request, including failed browser requests, counts toward the hourly limit.
- A `429`, CAPTCHA/rate-limit error, or repeated browser failures cools that proxy down for the target domain.
- Proxy Pool Manager shows the latest error/cooldown state and can remove bad proxies.

## Browser Profiles

- Static profiles have a fixed proxy and are locked to one active request. Assign them to APIs that must reuse cookies or session state.
- Disposable profiles are generated with a random standard fingerprint and selected proxy. Set reuse requests and idle retention in API Builder; they are removed automatically after their request limit or retention expiry.
- `AUTO` profile mode prefers an available assigned static profile, then creates a disposable profile when none is available.

## Run Commands

- Start normally:
```bash
npm start
```

- Restart and force specific port:
```bash
./restart.sh --port 4300
```

- Restart local mode on a specific port:
```bash
./restart.sh --local --port 4300
```

- Restart full mode (requires `DATABASE_URL`) on a specific port:
```bash
./restart.sh --full --port 4300
```

- Install + run shortcut (default 4300):
```bash
npm run install-and-run
```

## Remote MCP (Public Domain)

The app exposes a protected Streamable HTTP MCP endpoint at:

```text
https://your-public-domain.example/mcp
```

In **Browser Settings** > **Public MCP**, click **Generate New Token**, then
click **Copy Claude / Cursor Config**. The UI creates a ready-to-paste config
using the public domain of the current deployment. No project checkout or
local `mcp_server.js` file is required on the MCP client machine.

The copied config uses `mcp-remote`, matching the common Claude Desktop/Cursor
setup pattern:

```json
{
  "mcpServers": {
    "browser-api-factory": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://your-public-domain.example/mcp",
        "--header",
        "Authorization: Bearer <your-mcp-token>"
      ]
    }
  }
}
```

Clients with native remote-MCP support can connect directly to the endpoint
and send the same `Authorization: Bearer <your-mcp-token>` header. A generic
template is in `mcp.remote.example.json`.

The endpoint is disabled until a token is generated. Every MCP request,
including session setup, requires that bearer token. Rotating the token stops
existing clients from making further requests. Keep the app private and treat
the token like an administrator credential: MCP can read, modify, delete, and
execute browser scripts.

## Local MCP Bridge (Optional)

`mcp_server.js` is a local stdio MCP bridge for trusted coding agents. It talks
to the already running Browser API Factory over HTTP, so browser debugging and
script runs use the engine, profile, proxy, fingerprint, and queue settings
currently selected in the app.

Start the Browser API Factory first, then add the following block to your MCP
client configuration. Use the absolute project path on the machine where the
MCP client runs. A copyable template is also available in `mcp.example.json`.

```json
{
  "mcpServers": {
    "browser-api-factory": {
      "command": "node",
      "args": [
        "/absolute/path/to/browser_automation_tool/mcp_server.js"
      ],
      "env": {
        "BROWSER_API_URL": "http://127.0.0.1:4300",
        "BROWSER_API_TIMEOUT_MS": "300000"
      }
    }
  }
}
```

For an app on another trusted machine, set `BROWSER_API_URL` to that app's
private URL instead. The MCP process communicates through stdio, so configure
the client with `node .../mcp_server.js`, not `npm run mcp`; MCP reserves
standard output for protocol messages.

Available tools:

- `browser_factory_status`: verify that the app is running and inspect the redacted active browser configuration.
- `browser_factory_list_scripts`, `browser_factory_read_script`, `browser_factory_write_script`, and `browser_factory_delete_script`: manage saved automation code.
- `browser_factory_run_script`: run a saved script with `input` values and receive its JSON result plus browser logs.
- `browser_factory_debug_page`: navigate with the configured browser, inspect a selector, return text/HTML, and optionally receive a screenshot.
- `browser_factory_debug_run`: run temporary Playwright code with the normal script runtime objects. Its temporary script is always deleted after the run.

Recommended agent workflow: call `browser_factory_status`, inspect an existing
script, use `browser_factory_debug_page` to identify selectors, use
`browser_factory_debug_run` for a focused experiment, then save and run the
final script. Debug screenshots are stored under `data/mcp-debug/` and are
returned inline to MCP clients that support image results; old screenshots are
automatically removed after one hour.

This bridge can read, modify, delete, and execute browser scripts. Only attach
it to trusted local agents and keep the Browser API Factory private or behind
your network access controls.

## Browser Engines

- `chromium`: playwright-extra stack
- `chrome`: regular Chrome channel launch (closest to manual Chrome behavior)
- `camoufox`: requires `camoufox-js` runtime/binaries

If Camoufox fails on a fresh machine:

```bash
npm install
npx camoufox-js fetch
```

## API Overview

Base URL:

- `http://localhost:<PORT>`

### Health

```bash
curl "http://localhost:4300/api/health"
```

### Get / Save Config

```bash
curl "http://localhost:4300/api/config"
```

```bash
curl -X POST "http://localhost:4300/api/config" \
  -H "Content-Type: application/json" \
  -d '{
    "profileName":"default",
    "browserEngine":"chrome",
    "proxy":"",
    "headless":false,
    "timeoutMs":120000,
    "rotateProfileEveryNRequests":0,
    "rotateFingerprintWithProfile":false
  }'
```

### Run API Code Sync (GET)

All extra query params are passed to script as `input`.

```bash
curl "http://localhost:4300/api/run-sync?scriptName=ai_overview.js&request=closest%20planet&includeLogs=true"
```

Useful flags:

- `includeLogs=true`
- `ephemeral=true`
- `noProxy=true`
- `profileName=default`

### Run API Code Async (POST)

```bash
curl -X POST "http://localhost:4300/api/scripts/run" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"ai_overview.js",
    "input":{
      "request":"closest planet to earth",
      "noProxy":true
    }
  }'
```

### Runs API

```bash
curl "http://localhost:4300/api/runs"
curl "http://localhost:4300/api/runs/<runId>"
curl -X POST "http://localhost:4300/api/runs/<runId>/stop"
```

### Script CRUD API

```bash
curl "http://localhost:4300/api/scripts"
curl "http://localhost:4300/api/scripts/example.js"
```

```bash
curl -X PUT "http://localhost:4300/api/scripts/new_script.js" \
  -H "Content-Type: application/json" \
  -d '{"content":"log(\"hello\")"}'
```

```bash
curl -X DELETE "http://localhost:4300/api/scripts/new_script.js"
```

### Proxy Test

```bash
curl -X POST "http://localhost:4300/api/config/proxy/test" \
  -H "Content-Type: application/json" \
  -d '{"proxy":"user:pass@host:port"}'
```

### Recreate Profile

```bash
curl -X POST "http://localhost:4300/api/profile/recreate" \
  -H "Content-Type: application/json" \
  -d '{"profileName":"default"}'
```

## Script Runtime Contract

Each `.js` script runs inside async function context with:

- `page`
- `context`
- `browser`
- `playwright`
- `log(...args)`
- `sleep(ms)`
- `config`
- `stopRequested()`
- `input`
- `setResult(value)`

Recommended return payload:

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

## Profile/Fingerprint Rotation

In UI -> Browser Setup:

- `Rotate Profile Every (requests)`: `0` disables
- `Rotate fingerprint preset with profile recreation`: random preset on rotation

State file:

- `data/rotation_state.json`

## UI Extras

- API Builder with generated public endpoint preview
- Proxy Pool Manager with proxy health/cooldowns
- Static Profile Manager with fixed proxy assignment
- Upload/Download API code files in editor toolbar
- API Docs modal with copy-ready examples
- Sync input tester for `input` variables

## Project Structure

- `server.js` - Express API + script execution
- `browser_setup.js` - browser launch/fingerprint/proxy logic
- `public/` - UI
- `scripts/` - API code files
- `profile/` - browser profiles
- `data/` - runtime config/state
- `prisma/` - PostgreSQL schema and migration history

## GitHub Publish

```bash
cd /Users/noname/Documents/replit.com/browser_automation_tool
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```
