# Browser Automation Tool

Local Playwright automation runner with:

- script editor + run UI
- sync and async API execution
- browser engine selection (`chromium`, `chrome`, `camoufox`)
- proxy support
- profile recreation + fingerprint rotation controls

## Requirements

- Node.js 20+
- npm
- Linux/macOS (tested on macOS and Linux)

## Quick Start

Run full install + start on static port:

```bash
cd /Users/noname/Documents/replit.com/browser_automation_tool
./install_and_run.sh --port 4300
```

This will:

1. install npm packages
2. install Playwright browsers
3. fetch Camoufox binaries
4. start app on selected port

Open:

- `http://localhost:4300`

## Run Commands

- Start normally:
```bash
npm start
```

- Restart and force specific port:
```bash
./restart.sh --port 4300
```

- Install + run shortcut (default 4300):
```bash
npm run install-and-run
```

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

### Run Script Sync (GET)

All extra query params are passed to script as `input`.

```bash
curl "http://localhost:4300/api/run-sync?scriptName=ai_overview.js&request=closest%20planet&includeLogs=true"
```

Useful flags:

- `includeLogs=true`
- `ephemeral=true`
- `noProxy=true`
- `profileName=default`

### Run Script Async (POST)

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

- Upload/Download script files in editor toolbar
- API Docs modal with copy-ready examples
- Sync input tester for `input` variables

## Project Structure

- `server.js` - Express API + script execution
- `browser_setup.js` - browser launch/fingerprint/proxy logic
- `public/` - UI
- `scripts/` - user scripts
- `profile/` - browser profiles
- `data/` - runtime config/state

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

